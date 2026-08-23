'use client'
import { useRef, useEffect, useState, useCallback } from 'react'
import P2PVideoPlayer from './p2p-video-player'
import CustomControls from './custom-controls'

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

const VIDEO_HOSTS_FOR_SW = [
  'ujeklsj.site',
  'vid1.ujeklsj.site',
  'q-drama.com',
]

function isVideoHostForSW(url) {
  try {
    const hostname = new URL(url).hostname.toLowerCase()
    return VIDEO_HOSTS_FOR_SW.some(host => hostname === host || hostname.endsWith('.' + host))
  } catch {
    return false
  }
}

function shouldProxy(url) {
  if (!url) return false
  if (/\.m3u8(\?.*)?$/i.test(url)) return true
  if (/\.(mp4|webm|ogv|ogg|mov|m4v)(\?.*)?$/i.test(url)) {
    return !isVideoHostForSW(url)
  }
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

function HlsVideo({ url, title, initialTime = 0, onProgress }) {
  const videoRef = useRef(null)
  const hlsRef = useRef(null)
  const initialTimeRef = useRef(initialTime)

  initialTimeRef.current = initialTime

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    let destroyed = false

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url
    } else {
      import('hls.js').then(({ default: Hls }) => {
        if (destroyed) return
        const hls = new Hls({ maxBufferLength: 30 })
        hlsRef.current = hls
        hls.loadSource(url)
        hls.attachMedia(video)
        hls.on('error', () => {})
      })
    }

    return () => {
      destroyed = true
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
    }
  }, [url])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const doSeek = () => {
      const t = initialTimeRef.current
      if (t && video.duration && video.duration > 0 && video.currentTime < t - 2) {
        video.currentTime = t
      }
    }

    video.addEventListener('loadedmetadata', doSeek)

    const onTimeUpdate = () => {
      if (initialTimeRef.current && video.duration && video.currentTime < 1 && initialTimeRef.current > 1) {
        video.currentTime = initialTimeRef.current
      }
    }
    video.addEventListener('timeupdate', onTimeUpdate)

    return () => {
      video.removeEventListener('loadedmetadata', doSeek)
      video.removeEventListener('timeupdate', onTimeUpdate)
    }
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !onProgress) return
    let lastSave = 0
    const handler = () => {
      const now = Date.now()
      if (now - lastSave > 10000) {
        lastSave = now
        onProgress(Math.floor(video.currentTime), Math.floor(video.duration || 0))
      }
    }
    const handleEnded = () => {
      onProgress(0, Math.floor(video.duration || 0), true)
    }
    video.addEventListener('timeupdate', handler)
    video.addEventListener('ended', handleEnded)
    return () => {
      video.removeEventListener('timeupdate', handler)
      video.removeEventListener('ended', handleEnded)
    }
  }, [onProgress])

  return (
    <div className="absolute inset-0 w-full h-full bg-black">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="absolute inset-0 w-full h-full object-contain bg-black"
        title={title}
      />
      <CustomControls videoRef={videoRef} />
    </div>
  )
}

function SourceExtracting({ url, onExtracted, onError }) {
  const [status, setStatus] = useState('extracting')
  const [error, setError] = useState(null)
  const [progress, setProgress] = useState('جاري استخراج رابط الفيديو...')
  const extractionRef = useRef(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    if (extractionRef.current) return
    extractionRef.current = true

    let cancelled = false

    async function doExtract() {
      if (!EXTRACT_API) {
        if (mountedRef.current && !cancelled) {
          setError('Extract API not configured')
          setStatus('error')
          onError?.('Extract API not configured')
        }
        return
      }

      if (mountedRef.current && !cancelled) {
        setStatus('extracting')
        setProgress('جاري استخراج رابط الفيديو...')
      }

      try {
        const encodedUrl = encodeURIComponent(url)
        const res = await fetch(`${EXTRACT_API}/api/extract?url=${encodedUrl}`, {
          signal: AbortSignal.timeout(90000),
        })
        const data = await res.json()

        if (cancelled) return

        if (data.m3u8) {
          if (mountedRef.current) {
            setStatus('success')
            setProgress('تم الاستخراج بنجاح!')
          }
          onExtracted?.(data.m3u8)
        } else {
          throw new Error(data.error || 'Extraction failed')
        }
      } catch (err) {
        if (cancelled) return
        if (err.name === 'TimeoutError') {
          setError('انتهت مهلة الاستخراج')
        } else {
          setError(err.message || 'حدث خطأ أثناء الاستخراج')
        }
        if (mountedRef.current) {
          setStatus('error')
        }
        onError?.(err.message)
      }
    }

    doExtract()

    return () => { cancelled = true }
  }, [url])

  const retry = useCallback(() => {
    extractionRef.current = false
    setError(null)
    setStatus('extracting')
    setProgress('جاري إعادة الاستخراج...')
  }, [])

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
            onClick={retry}
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

function DirectVideo({ src, title, initialTime = 0, onProgress }) {
  const videoRef = useRef(null)
  const initialTimeRef = useRef(initialTime)

  initialTimeRef.current = initialTime

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const doSeek = () => {
      const t = initialTimeRef.current
      if (t && video.duration && video.duration > 0 && video.currentTime < t - 2) {
        video.currentTime = t
      }
    }

    video.addEventListener('loadedmetadata', doSeek)

    const onTimeUpdate = () => {
      if (initialTimeRef.current && video.duration && video.currentTime < 1 && initialTimeRef.current > 1) {
        video.currentTime = initialTimeRef.current
      }
    }
    video.addEventListener('timeupdate', onTimeUpdate)

    return () => {
      video.removeEventListener('loadedmetadata', doSeek)
      video.removeEventListener('timeupdate', onTimeUpdate)
    }
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !onProgress) return
    let lastSave = 0
    const handler = () => {
      const now = Date.now()
      if (now - lastSave > 10000) {
        lastSave = now
        onProgress(Math.floor(video.currentTime), Math.floor(video.duration || 0))
      }
    }
    const handleEnded = () => {
      onProgress(0, Math.floor(video.duration || 0), true)
    }
    video.addEventListener('timeupdate', handler)
    video.addEventListener('ended', handleEnded)
    return () => {
      video.removeEventListener('timeupdate', handler)
      video.removeEventListener('ended', handleEnded)
    }
  }, [onProgress])

  return (
    <div className="absolute inset-0 w-full h-full bg-black">
      <video
        ref={videoRef}
        src={src}
        autoPlay
        playsInline
        className="absolute inset-0 w-full h-full object-contain bg-black"
        title={title}
      />
      <CustomControls videoRef={videoRef} />
    </div>
  )
}

export default function VideoPlayer({ url, activeStreamUrl, title = '', contentId, contentType, initialTime = 0, onProgress }) {
  const [extractedUrl, setExtractedUrl] = useState(null)
  const [introUrl, setIntroUrl] = useState(null)
  const [introChecked, setIntroChecked] = useState(false)
  const [introEnded, setIntroEnded] = useState(false)
  const introRef = useRef(null)
  const prevUrlRef = useRef(null)

  const currentUrl = activeStreamUrl || url

  useEffect(() => {
    if (prevUrlRef.current !== null && prevUrlRef.current !== currentUrl && introUrl) {
      setIntroEnded(false)
    }
    prevUrlRef.current = currentUrl
  }, [currentUrl, introUrl])

  useEffect(() => {
    import('@/lib/supabase').then(({ supabase }) => {
      supabase
        .from('site_settings')
        .select('setting_value')
        .eq('setting_key', 'intro_video_url')
        .maybeSingle()
        .then(({ data }) => {
          setIntroUrl(data?.setting_value || null)
          setIntroChecked(true)
        })
        .catch(() => setIntroChecked(true))
    })
  }, [])

  const handleExtracted = useCallback((m3u8) => {
    setExtractedUrl(m3u8)
  }, [])

  const resolvedUrl = activeStreamUrl || url

  if (!introChecked) {
    return (
      <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-gray-900">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 border-4 border-red-600/20 rounded-full" />
          <div className="absolute inset-0 border-4 border-transparent border-t-red-600 rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  const showIntro = introUrl && !introEnded

  if (showIntro) {
    return (
      <video
        ref={introRef}
        key={currentUrl}
        src={introUrl}
        autoPlay
        playsInline
        controls={false}
        className="absolute inset-0 w-full h-full object-contain bg-black"
        onEnded={() => setIntroEnded(true)}
      />
    )
  }

  if (!resolvedUrl) {
    return (
      <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-gray-900">
        <p className="text-gray-400">الفيديو غير متوفر حالياً</p>
      </div>
    )
  }

  if (isSourcePageUrl(resolvedUrl) && !extractedUrl) {
    return (
      <SourceExtracting
        url={resolvedUrl}
        onExtracted={handleExtracted}
        onError={() => {}}
      />
    )
  }

  const playUrl = extractedUrl || resolvedUrl
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
    return <HlsVideo url={src} title={title} initialTime={initialTime} onProgress={onProgress} />
  }

  if (result.type === 'video') {
    const isDirectVideoHost = isVideoHostForSW(result.embed)
    const src = isDirectVideoHost ? result.embed : (shouldProxy(result.embed) ? proxyUrl(result.embed, contentId, contentType) : result.embed)
    return (
      <P2PVideoPlayer 
        src={src} 
        title={title} 
        initialTime={initialTime} 
        onProgress={onProgress}
        onError={() => {}}
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
