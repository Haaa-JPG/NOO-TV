'use client'
import { useState } from 'react'

// Smart video player with built-in ad/redirect protection.
// Known providers (YouTube, Vimeo, etc.) render normally.
// Unknown providers (anaplayer, etc.) get:
//   - a transparent click-shield that blocks redirect-inducing clicks
//   - a black top-bar strip that hides ad / server-select buttons

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
  const [shield, setShield] = useState(true)

  return (
    <>
      <iframe src={embedUrl} className={`w-full h-full bg-black ${className}`} title={title} allowFullScreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen; web-share" />

      {/* Click shield: blocks every click so nothing can open popups or redirect.
          Positioned relative to the grandparent (the relative container).
          The iframe still plays the video normally — clicks just don't reach it. */}
      {shield && (
        <div className="absolute inset-0 bg-transparent" style={{ zIndex: 40, cursor: 'default' }} />
      )}

      {/* Floating control bar — sits above the click shield */}
      <div className="absolute top-0 left-0 right-0 flex justify-end p-2" style={{ zIndex: 50, pointerEvents: 'none' }}>
        <button
          type="button"
          onClick={() => setShield((s) => !s)}
          style={{ pointerEvents: 'auto' }}
          className={`text-xs rounded px-2 py-1 shadow ${shield ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}
        >
          {shield ? 'الحماية مفعّلة' : 'الحماية معطّلة'}
        </button>
      </div>
    </>
  )
}
