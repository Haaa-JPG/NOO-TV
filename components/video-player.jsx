'use client'
import { useRef, useEffect, useState, useCallback } from 'react'

const EXTRACT_API = process.env.NEXT_PUBLIC_EXTRACT_URL || ''

const SOURCE_PATTERNS = [
  /z\.3isk\.news/i,
  /qrmzi\.tv/i,
  /3isk/i,
  /krmzi\.space/i,
  /anaplayer/i,
]

function isSourcePageUrl(url) {
  return SOURCE_PATTERNS.some(p => p.test(url))
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

function SourceExtracting({ url, onExtracted, onError }) {
  const [status, setStatus] = useState('extracting')
  const [error, setError] = useState(null)
  const [progress, setProgress] = useState('جاري استخراج رابط الفيديو...')

  const doExtract = useCallback(async () => {
    if (!EXTRACT_API) {
      setError('Extract API not configured')
      setStatus('error')
      onError?.('Extract API not configured')
      return
    }

    setStatus('extracting')
    setProgress('جاري استخراج رابط الفيديو...')

    try {
      const encodedUrl = encodeURIComponent(url)
      const res = await fetch(`${EXTRACT_API}/api/extract?url=${encodedUrl}`, {
        signal: AbortSignal.timeout(90000),
      })
      const data = await res.json()

      if (data.m3u8) {
        setStatus('success')
        setProgress('تم الاستخراج بنجاح!')
        onExtracted?.(data.m3u8)
      } else {
        throw new Error(data.error || 'Extraction failed')
      }
    } catch (err) {
      if (err.name === 'TimeoutError') {
        setError('انتهت مهلة الاستخراج')
      } else {
        setError(err.message || 'حدث خطأ أثناء الاستخراج')
      }
      setStatus('error')
      onError?.(err.message)
    }
  }, [url, onExtracted, onError])

  useEffect(() => {
    doExtract()
  }, [doExtract])

  if (status === 'success') {
    return (
      <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-gray-950 gap-4">
        <div className="w-12 h-12 border-4 border-green-600 rounded-full flex items-center justify-center">
          <span className="text-green-600 text-xl">✓</span>
        </div>
        <p className="text-green-400 text-sm">{progress}</p>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-gray-950 gap-4">
        <div className="w-16 h-16 border-4 border-red-600/30 rounded-full flex items-center justify-center">
          <span className="text-red-500 text-2xl">✕</span>
        </div>
        <div className="text-center space-y-2">
          <p className="text-red-400 text-sm font-medium">تعذر استخراج الفيديو</p>
          <p className="text-gray-500 text-xs">{error}</p>
          <button
            onClick={() => { setError(null); setStatus('extracting'); doExtract() }}
            className="mt-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs rounded-lg transition"
          >
            إعادة المحاولة
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-gray-950 gap-4">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 border-4 border-red-600/20 rounded-full" />
        <div className="absolute inset-0 border-4 border-transparent border-t-red-600 rounded-full animate-spin" />
      </div>
      <div className="text-center space-y-2">
        <p className="text-white text-sm font-medium">{progress}</p>
        <p className="text-gray-400 text-xs">قد يستغرق هذا بضع ثوانٍ</p>
      </div>
    </div>
  )
}

export default function VideoPlayer({ url, title = '', contentId, contentType }) {
  const [extractedUrl, setExtractedUrl] = useState(null)

  if (!url) {
    return (
      <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-gray-900">
        <p className="text-gray-400">الفيديو غير متوفر حالياً</p>
      </div>
    )
  }

  if (isSourcePageUrl(url) && !extractedUrl) {
    return (
      <SourceExtracting
        url={url}
        onExtracted={(m3u8) => setExtractedUrl(m3u8)}
        onError={() => {}}
      />
    )
  }

  const playUrl = extractedUrl || url
  const result = toEmbedUrl(playUrl)

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
