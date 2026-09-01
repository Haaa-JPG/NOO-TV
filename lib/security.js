/**
 * Input Sanitization & Validation Utilities
 * OWASP A03:2021 - Injection Prevention
 */

/**
 * Encode HTML entities to prevent XSS
 * More robust than simple regex-based HTML stripping
 */
export function encodeHtmlEntities(str) {
  if (typeof str !== 'string') return ''
  const htmlEntities = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
    '`': '&#96;',
  }
  return str.replace(/[&<>"'`\/]/g, (char) => htmlEntities[char])
}

/**
 * Strip all HTML tags from a string
 * Used for plain-text fields (display names, subjects, etc.)
 */
export function stripHtmlTags(str) {
  if (typeof str !== 'string') return ''
  return str.replace(/<[^>]*>/g, '')
}

/**
 * Sanitize a string for safe display: strip HTML + encode entities
 */
export function sanitizeText(str, maxLength = 1000) {
  if (typeof str !== 'string') return ''
  return encodeHtmlEntities(stripHtmlTags(str)).substring(0, maxLength)
}

/**
 * Validate email format (RFC 5322 simplified)
 */
export function isValidEmail(email) {
  if (typeof email !== 'string') return false
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
  return emailRegex.test(email) && email.length <= 254
}

/**
 * Validate UUID v4 format
 */
export function isValidUUID(str) {
  if (typeof str !== 'string') return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str)
}

/**
 * Validate URL format and ensure it's http/https
 */
export function isValidHttpUrl(str) {
  if (typeof str !== 'string') return false
  try {
    const url = new URL(str)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Validate that a string contains only safe characters (no control chars, no injection patterns)
 */
export function isCleanString(str, maxLength = 500) {
  if (typeof str !== 'string') return false
  if (str.length > maxLength) return false
  // Reject null bytes, control characters
  if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(str)) return false
  return true
}

/**
 * Validate numeric value within range
 */
export function isWithinRange(value, min, max) {
  const num = Number(value)
  return !isNaN(num) && num >= min && num <= max
}

/**
 * Rate limit key sanitizer - prevents key injection
 */
export function sanitizeRateLimitKey(key) {
  if (typeof key !== 'string') return 'unknown'
  return key.replace(/[^a-zA-Z0-9:\-_.]/g, '').substring(0, 100)
}

/**
 * Extract and validate IP from request headers
 * Returns 'unknown' if no valid IP found
 */
export function extractClientIP(request) {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    const firstIp = forwarded.split(',')[0]?.trim()
    if (firstIp && /^[\d.:a-fA-F]+$/.test(firstIp)) {
      return firstIp
    }
  }
  const realIp = request.headers.get('x-real-ip')
  if (realIp && /^[\d.:a-fA-F]+$/.test(realIp)) {
    return realIp
  }
  return 'unknown'
}
