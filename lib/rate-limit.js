const rateLimitStore = new Map()

export function checkRateLimit(key, maxRequests = 10, windowMs = 60000) {
  const now = Date.now()
  const record = rateLimitStore.get(key)
  if (!record || now - record.start > windowMs) {
    rateLimitStore.set(key, { start: now, count: 1 })
    return true
  }
  record.count++
  return record.count <= maxRequests
}

export function getRateLimitStats() {
  return { totalKeys: rateLimitStore.size }
}

// Run cleanup every 5 minutes
let lastCleanup = Date.now()
const CLEANUP_INTERVAL = 5 * 60 * 1000
const MAX_AGE = 10 * 60 * 1000

function runCleanup() {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  lastCleanup = now
  for (const [key, val] of rateLimitStore) {
    if (now - val.start > MAX_AGE) rateLimitStore.delete(key)
  }
}

// Run on first check
export function maybeCleanup() {
  runCleanup()
}
