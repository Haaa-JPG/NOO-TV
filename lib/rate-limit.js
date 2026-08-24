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

if (rateLimitStore.size > 5000) {
  const now = Date.now()
  for (const [key, val] of rateLimitStore) {
    if (now - val.start > 60000) rateLimitStore.delete(key)
  }
}
