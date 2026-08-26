const { getDb } = require('./db')

const STREAMING_API_URL = process.env.STREAMING_API_URL
const STREAMING_API_KEY = process.env.STREAMING_API_KEY

function getApiKey(source) {
  if (source?.api_key) return source.api_key
  if (STREAMING_API_KEY) return STREAMING_API_KEY
  return null
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 30000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...options, signal: controller.signal })
    clearTimeout(timer)
    return res
  } catch (err) {
    clearTimeout(timer)
    throw err
  }
}

async function healthCheck(source) {
  const db = getDb()
  try {
    const url = source.api_base_url.replace(/\/+$/, '') + '/health'
    const apiKey = getApiKey(source)
    const headers = { 'Content-Type': 'application/json' }
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`

    const start = Date.now()
    const res = await fetchWithTimeout(url, { headers }, 10000)
    const elapsed = Date.now() - start
    const status = res.ok ? 'healthy' : 'degraded'

    await db.query(
      `UPDATE public.streaming_sources
       SET health_status = $1, last_health_check = NOW(), avg_response_ms = $2, updated_at = NOW()
       WHERE id = $3`,
      [status, elapsed, source.id]
    )
    return { status, elapsed }
  } catch (err) {
    await db.query(
      `UPDATE public.streaming_sources
       SET health_status = 'down', last_health_check = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [source.id]
    )
    return { status: 'down', error: err.message }
  }
}

async function extractPlayback(source, contentId, contentType, sourceContentId) {
  const db = getDb()
  const apiKey = getApiKey(source)
  const baseUrl = source.api_base_url.replace(/\/+$/, '')

  const job = await db.query(
    `INSERT INTO public.streaming_jobs (source_id, content_id, content_type, job_type, status)
     VALUES ($1, $2, $3, 'extract', 'pending')
     RETURNING id`,
    [source.id, contentId, contentType]
  )
  const jobId = job.rows[0].id

  try {
    const headers = { 'Content-Type': 'application/json' }
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`

    const res = await fetchWithTimeout(
      `${baseUrl}/extract`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          content_id: sourceContentId || contentId,
          content_type: contentType,
        }),
      },
      60000
    )

    const data = await res.json()

    if (!res.ok || !data.url) {
      throw new Error(data.error || `Extract failed: ${res.status}`)
    }

    await db.query(
      `SELECT public.complete_streaming_job($1, $2)`,
      [jobId, data.url]
    )

    // Update source stats
    await db.query(
      `UPDATE public.streaming_sources
       SET total_requests = total_requests + 1, updated_at = NOW()
       WHERE id = $1`,
      [source.id]
    )

    return { jobId, url: data.url, expiresAt: data.expires_at || null }
  } catch (err) {
    await db.query(
      `SELECT public.fail_streaming_job($1, $2)`,
      [jobId, err.message]
    )

    await db.query(
      `UPDATE public.streaming_sources
       SET failed_requests = failed_requests + 1, total_requests = total_requests + 1,
           success_rate = CASE WHEN total_requests + 1 > 0
             THEN ROUND((total_requests - failed_requests - 1)::numeric / (total_requests + 1) * 100, 2)
             ELSE 0 END,
           updated_at = NOW()
       WHERE id = $1`,
      [source.id]
    )

    throw err
  }
}

async function refreshPlayback(source, contentId, contentType, sourceContentId) {
  const db = getDb()
  const apiKey = getApiKey(source)
  const baseUrl = source.api_base_url.replace(/\/+$/, '')

  const job = await db.query(
    `INSERT INTO public.streaming_jobs (source_id, content_id, content_type, job_type, status)
     VALUES ($1, $2, $3, 'refresh', 'pending')
     RETURNING id`,
    [source.id, contentId, contentType]
  )
  const jobId = job.rows[0].id

  try {
    const headers = { 'Content-Type': 'application/json' }
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`

    const res = await fetchWithTimeout(
      `${baseUrl}/refresh`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          content_id: sourceContentId || contentId,
          content_type: contentType,
        }),
      },
      60000
    )

    const data = await res.json()

    if (!res.ok || !data.url) {
      throw new Error(data.error || `Refresh failed: ${res.status}`)
    }

    await db.query(
      `SELECT public.complete_streaming_job($1, $2)`,
      [jobId, data.url]
    )

    return { jobId, url: data.url, expiresAt: data.expires_at || null }
  } catch (err) {
    await db.query(
      `SELECT public.fail_streaming_job($1, $2)`,
      [jobId, err.message]
    )
    throw err
  }
}

async function getActiveSources() {
  const db = getDb()
  const { rows } = await db.query(
    `SELECT * FROM public.streaming_sources
     WHERE is_active = TRUE
     ORDER BY priority DESC, created_at ASC`
  )
  return rows
}

async function getSourceById(id) {
  const db = getDb()
  const { rows } = await db.query(
    `SELECT * FROM public.streaming_sources WHERE id = $1`,
    [id]
  )
  return rows[0] || null
}

async function getSourceForContent(contentId, contentType) {
  const db = getDb()
  const { rows } = await db.query(
    `SELECT ss.*, css.source_content_id, css.priority as content_priority
     FROM public.content_streaming_sources css
     JOIN public.streaming_sources ss ON ss.id = css.source_id
     WHERE css.content_id = $1 AND css.content_type = $2 AND css.is_active = TRUE AND ss.is_active = TRUE
     ORDER BY css.priority DESC, ss.priority DESC`,
    [contentId, contentType]
  )
  return rows
}

async function getActiveJobs(sourceId) {
  const db = getDb()
  let query = `SELECT * FROM public.streaming_jobs WHERE status IN ('pending', 'processing')`
  const params = []
  if (sourceId) {
    params.push(sourceId)
    query += ` AND source_id = $1`
  }
  query += ` ORDER BY created_at ASC`
  const { rows } = await db.query(query, params)
  return rows
}

async function getJobsBySource(sourceId, limit = 50) {
  const db = getDb()
  const { rows } = await db.query(
    `SELECT * FROM public.streaming_jobs
     WHERE source_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [sourceId, limit]
  )
  return rows
}

module.exports = {
  healthCheck,
  extractPlayback,
  refreshPlayback,
  getActiveSources,
  getSourceById,
  getSourceForContent,
  getActiveJobs,
  getJobsBySource,
}
