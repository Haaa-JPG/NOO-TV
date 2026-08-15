const { createClient } = require('@supabase/supabase-js')
const { scrapeM3u8, isSourceUrl } = require('./services/scraper')

const CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '1', 10)

function getSupabase() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY
  if (!url || !key) {
    console.error('[ERROR] Missing SUPABASE_URL or SUPABASE_ANON_KEY')
    process.exit(1)
  }
  return createClient(url, key)
}

async function main() {
  console.log('=== NOO TV Link Updater (Jobs-based) ===')
  console.log('Time:', new Date().toISOString())

  const supabase = getSupabase()

  const { data: episodes, error: fetchError } = await supabase
    .from('episodes')
    .select('id, embed_url, source_url, active_stream_url, last_refreshed, stream_status')
    .eq('is_active', true)

  if (fetchError) {
    console.error('[ERROR] Fetch failed:', fetchError.message)
    process.exit(1)
  }

  console.log('Total active episodes:', episodes?.length || 0)

  if (!episodes || episodes.length === 0) {
    console.log('No episodes found. Done.')
    return
  }

  const needsRefresh = episodes.filter((ep) => {
    const streamUrl = ep.active_stream_url || ep.embed_url
    if (!streamUrl) return true
    if (!isSourceUrl(streamUrl)) return false
    if (ep.stream_status === 'completed') return false
    if (ep.stream_status === 'processing') return false
    return true
  })

  console.log('Needs extraction:', needsRefresh.length)

  if (needsRefresh.length === 0) {
    console.log('All episodes are fresh. Done.')
    return
  }

  let createdJobs = 0
  for (const ep of needsRefresh) {
    const sourceUrl = ep.source_url || ep.embed_url
    const { data: existing } = await supabase
      .from('jobs')
      .select('id')
      .eq('episode_id', ep.id)
      .in('status', ['pending', 'processing', 'retrying'])
      .limit(1)
      .maybeSingle()

    if (!existing) {
      await supabase.from('jobs').insert({
        job_type: 'extract',
        episode_id: ep.id,
        content_type: 'episode',
        source_url: sourceUrl,
        status: 'pending',
        priority: 5,
        max_attempts: 3,
      })
      createdJobs++
    }
  }

  console.log(`Created ${createdJobs} jobs`)

  let processed = 0
  let failed = 0

  for (const ep of needsRefresh) {
    const { data: job, error: claimError } = await supabase.rpc('claim_next_job')
    if (claimError || !job) {
      console.log('No more jobs to process')
      break
    }

    console.log(`\n[${processed + failed + 1}/${needsRefresh.length}] Job ${job.id}`)
    console.log('  Episode:', job.episode_id)
    console.log('  URL:', job.source_url?.substring(0, 80))

    try {
      const { m3u8Url, expiresAt } = await scrapeM3u8(job.source_url)

      if (m3u8Url) {
        console.log('  Got m3u8:', m3u8Url.substring(0, 100))
        await supabase.rpc('complete_job', { p_job_id: job.id, p_result_url: m3u8Url })

        if (job.episode_id) {
          await supabase
            .from('episodes')
            .update({
              active_stream_url: m3u8Url,
              embed_url: m3u8Url,
              expires_at: expiresAt,
              last_refreshed: new Date().toISOString(),
              stream_status: 'completed',
              last_error: null,
            })
            .eq('id', job.episode_id)
        }

        console.log('  Updated successfully')
        processed++
      } else {
        console.log('  No m3u8 found')
        await supabase.rpc('fail_job', { p_job_id: job.id, p_error: 'No m3u8 found' })
        failed++
      }
    } catch (err) {
      console.error('  Error:', err.message)
      await supabase.rpc('fail_job', { p_job_id: job.id, p_error: err.message })
      failed++
    }
  }

  console.log('\n=== Done ===')
  console.log('Processed:', processed)
  console.log('Failed:', failed)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
