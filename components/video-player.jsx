'use client'
import { useRef, useEffect, useState } from 'react'

// Smart video player — supports any source:
// - YouTube / Vimeo / Dailymotion / Wistia → embed iframe
// - .m3u8 (HLS) → native video with hls.js
// - .mp4 / .webm / .mov / .ogv → native HTML5 video
// - Source page URLs (3isk, qrmzi) → auto-extract m3u8 via /api/extract
// - Full iframe embed codes → extract src and render
// - Any other URL → generic iframe

const EXTRACT_PATTERNS = [
  /z\.3isk\.news/i,
  /qrmzi\.tv/i,
  /3isk/i,
  /krmzi\.space/i,
  /anaplayer/i,
]

function isSourcePageUrl(url) {
  return EXTRACT_PATTERNS.some(p => p.test(url))
}

function parseYouTube(url) {
  const patterns = [
    /(?:youtube\.com|youtu\.be)\/watch\?(?:.*&)?v=([\w-]{11})/,
    /youtu\.be\/([\w-]{11})/,
    /youtube\.com\/embed\/([\w-]{11})/,
    /youtube\.com\/shorts\/([\w-]{11})/,
    /youtube\.com\/live\/([\w-]{11})/,
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m) return { embed: `https://www.youtube.com/embed/${m[1]}`, type: 'iframe' }
  }
  return null
}

function parseVimeo(url) {
  const m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/)
  return m ? { embed: `https://player.vimeo.com/video/${m[1]}`, type: 'iframe' } : null
}

function parseDailymotion(url) {
  const m = url.match(/(?:dailymotion\.com|dai\.ly)\/video\/([\w]+)/)
  return m ? { embed: `https://www.dailymotion.com/embed/video/${m[1]}`, type: 'iframe' } : null
}

function parseWistia(url) {
  const m = url.match(/wistia\.(?:com|net)\/medias\/([\w]+)/)
  return m ? { embed: `https://fast.wistia.net/embed/iframe/${m[1]}`, type: 'iframe' } : null
}

function detectType(url) {
  if (/\.m3u8(\?.*)?$/i.test(url)) return 'hls'
  if (/\.(mp4|webm|ogv|ogg|mov|m4v)(\?.*)?$/i.test(url)) return 'video'
  return 'iframe'
}

const PROXY_HOSTS = ['cdnz.quest', 'cdnwistia', 'wistia.']

function shouldProxy(url) {
  if (!url) return false
  if (/\.m3u8(\?.*)?$/i.test(url)) return true
  if (/\.(mp4|webm|ogv|ogg|mov|m4v)(\?.*)?$/i.test(url)) return true
  for (const h of PROXY_HOSTS) {
    if (url.includes(h)) return true
  }
  return false
}

function proxyUrl(url, contentId, contentType) {
  if (!url) return url
  const params = new URLSearchParams({ url })
  if (contentId) params.set('id', contentId)
  if (contentType) params.set('type', contentType)
  return `/api/proxy?${params.toString()}`
}

function extractIframeSrc(value) {
  const m = value.match(/<iframe[^>]*\ssrc\s*=\s*["']([^"']+)["']/i)
  return m ? m[1] : null
}

function toEmbedUrl(url) {
  if (!url) return null
  const trimmed = url.trim()
  const iframeSrc = extractIframeSrc(trimmed)
  if (iframeSrc) return toEmbedUrl(iframeSrc)
  let normalized = trimmed
  if (!/^https?:\/\//i.test(normalized)) normalized = `https://${normalized}`
  return (
    parseYouTube(normalized) ||
    parseVimeo(normalized) ||
    parseDailymotion(normalized) ||
    parseWistia(normalized) ||
    { embed: normalized, type: detectType(normalized) }
  )
}

function HlsVideo({ url, title }) {
  const videoRef = useRef(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    let hls = null

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url
    } else {
      import('hls.js').then(({ default: Hls }) => {
        hls = new Hls({ maxBufferLength: 30 })
        hls.loadSource(url)
        hls.attachMedia(video)
        hls.on('error', () => {})
      })
    }

    return () => { if (hls) hls.destroy() }
  }, [url])

  return (
    <video
      ref={videoRef}
      controls
      autoPlay
      playsInline
      className="absolute inset-0 w-full h-full object-contain bg-black"
      title={title}
    />
  )
}

function ExtractingPlayer({ sourceUrl, title, contentId, contentType }) {
  const [m3u8, setM3u8] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function extract() {
      try {
        const res = await fetch(`/api/extract?url=${encodeURIComponent(sourceUrl)}`)
        const data = await res.json()
        if (cancelled) return
        if (!res.ok) throw new Error(data.error || 'Failed to extract')
        setM3u8(data.m3u8)
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    extract()
    return () => { cancelled = true }
  }, [sourceUrl])

  if (loading) {
    return (
      <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-gray-900 gap-3">
        <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-400 text-sm">جاري استخراج رابط البث...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-gray-900 gap-2">
        <p className="text-red-400 text-sm">فشل استخراج رابط البث</p>
        <p className="text-gray-500 text-xs">{error}</p>
      </div>
    )
  }

  const src = shouldProxy(m3u8) ? proxyUrl(m3u8, contentId, contentType) : m3u8
  return <HlsVideo url={src} title={title} />
}

export default function VideoPlayer({ url, title = '', contentId, contentType }) {
  if (!url) {
    return (
      <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-gray-900">
        <p className="text-gray-400">الفيديو غير متوفر حالياً</p>
      </div>
    )
  }

  if (isSourcePageUrl(url)) {
    return <ExtractingPlayer sourceUrl={url} title={title} contentId={contentId} contentType={contentType} />
  }

  const result = toEmbedUrl(url)

  if (!result) {
    return (
      <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-gray-900">
        <p className="text-gray-400">الفيديو غير متوفر حالياً</p>
      </div>
    )
  }

  if (result.type === 'hls') {
    const src = shouldProxy(result.embed) ? proxyUrl(result.embed, contentId, contentType) : result.embed
    return <HlsVideo url={src} title={title} />
  }

  if (result.type === 'video') {
    const src = shouldProxy(result.embed) ? proxyUrl(result.embed, contentId, contentType) : result.embed
    return (
      <video
        src={src}
        controls
        autoPlay
        playsInline
        className="absolute inset-0 w-full h-full object-contain bg-black"
        title={title}
      />
    )
  }

  // iframe — YouTube, Vimeo, Dailymotion, Wistia, or any other
  return (
    <iframe
      src={result.embed}
      className="absolute inset-0 w-full h-full bg-black"
      title={title}
      allowFullScreen
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      referrerPolicy="strict-origin-when-cross-origin"
    />
  )
}
