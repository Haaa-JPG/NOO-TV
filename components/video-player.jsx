'use client'
import { useRef } from 'react'

// Smart video player with built-in ad/redirect protection.
// Known providers (YouTube, Vimeo, etc.) render normally.
// Unknown providers (anaplayer, etc.) get:
//   - a transparent click shield that permanently blocks redirect-causing clicks
//   - a floating control bar (play/pause, fullscreen) so you never need to click the video

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
    if (m) return `https://www.youtube.com/embed/${m[1]}`
  }
  return null
}

function parseVimeo(u) {
  const m = u.match(/vimeo\.com\/(?:video\/)?(\d+)/)
  return m ? `https://player.vimeo.com/video/${m[1]}` : null
}

function parseDailymotion(u) {
  const m = u.match(/(?:dailymotion\.com|dai\.ly)\/video\/([\w]+)/)
  return m ? `https://www.dailymotion.com/embed/video/${m[1]}` : null
}

function parseWistia(u) {
  const m = u.match(/wistia\.(?:com|net)\/medias\/([\w]+)/)
  return m ? `https://fast.wistia.net/embed/iframe/${m[1]}` : null
}

function isDirectVideo(url) {
  return /\.(mp4|webm|ogv|ogg|mov|m4v)(\?.*)?$/i.test(url)
}

function extractIframeSrc(value) {
  const m = value.match(/<iframe[^>]*\ssrc\s*=\s*["']([^"']+)["']/i)
  return m ? m[1] : null
}

function isKnownProvider(url) {
  return (
    url.includes('youtube.com') ||
    url.includes('youtu.be') ||
    url.includes('vimeo.com') ||
    url.includes('dailymotion.com') ||
    url.includes('wistia.com') ||
    url.includes('wistia.net')
  )
}

export function toEmbedUrl(url) {
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
    normalized
  )
}

export default function VideoPlayer({ url, title = '', className = '' }) {
  const embedUrl = toEmbedUrl(url)

  if (!embedUrl) {
    return (
      <div className={`w-full h-full flex items-center justify-center bg-gray-900 ${className}`}>
        <p className="text-gray-400">الفيديو غير متوفر حالياً</p>
      </div>
    )
  }

  if (isDirectVideo(embedUrl)) {
    return (
      <div className={className}>
        <video src={embedUrl} controls autoPlay playsInline className="w-full h-full object-contain bg-black" title={title} />
      </div>
    )
  }

  if (isKnownProvider(embedUrl)) {
    return (
      <div className={className}>
        <iframe src={embedUrl} className="w-full h-full bg-black" title={title} allowFullScreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen; web-share" />
      </div>
    )
  }

  return <ProtectedPlayer embedUrl={embedUrl} title={title} className={className} />
}

function ProtectedPlayer({ embedUrl, title, className }) {
  const iframeRef = useRef(null)

  const sendKey = (key) => {
    const el = iframeRef.current
    if (!el) return
    el.focus()
    el.dispatchEvent(new KeyboardEvent('keydown', { key, code: key === ' ' ? 'Space' : key.toUpperCase(), bubbles: true, cancelable: true }))
  }

  return (
    <>
      <iframe
        ref={iframeRef}
        src={embedUrl}
        className={`w-full h-full bg-black ${className}`}
        title={title}
        allowFullScreen
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen; web-share"
      />

      {/* Permanent click shield — blocks ALL clicks from reaching the iframe.
          This prevents ad scripts from redirecting you when you click the video.
          Video auto-plays and still works — you just can't click on it directly. */}
      <div className="absolute inset-0" style={{ zIndex: 40 }} />

      {/* Floating control bar — always visible above the shield */}
      <div className="absolute top-2 left-0 right-0 flex justify-center" style={{ zIndex: 50, pointerEvents: 'none' }}>
        <div className="flex items-center gap-3 bg-black/70 backdrop-blur-sm rounded-full px-4 py-2" style={{ pointerEvents: 'auto' }}>
          <button
            type="button"
            onClick={() => sendKey(' ')}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            title="تشغيل / إيقاف"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          </button>
          <button
            type="button"
            onClick={() => sendKey('f')}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            title="شاشة كاملة"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
          </button>
          <button
            type="button"
            onClick={() => sendKey('m')}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            title="كتم الصوت"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
          </button>
        </div>
      </div>
    </>
  )
}
