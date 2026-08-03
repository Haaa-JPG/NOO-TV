'use client'
import { useState } from 'react'

// Smart video player that supports any embed/video source:
// - YouTube (watch, youtu.be, shorts, embed) -> converted to embed
// - Vimeo -> converted to embed
// - Dailymotion -> converted to embed
// - Direct video files (mp4, webm, ogv, mov) -> HTML5 video tag
// - Any other URL -> rendered inside an iframe

// For unknown sources (third-party players with ads / server bars):
// - sandbox blocks top navigation, popups and redirects on click
// - a toggleable black strip hides the top bar & ad buttons inside the player

function parseYouTube(url) {
  // https://www.youtube.com/watch?v=ID
  // https://youtu.be/ID
  // https://www.youtube.com/embed/ID
  // https://www.youtube.com/shorts/ID
  // https://youtube.com/live/ID
  const patterns = [
    /(?:youtube\.com|youtu\.be)\/watch\?(?:.*&)?v=([\w-]{11})/,
    /youtu\.be\/([\w-]{11})/,
    /youtube\.com\/embed\/([\w-]{11})/,
    /youtube\.com\/shorts\/([\w-]{11})/,
    /youtube\.com\/live\/([\w-]{11})/,
  ]
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return `https://www.youtube.com/embed/${match[1]}`
  }
  return null
}

function parseVimeo(url) {
  const match = url.match(/(?:vimeo\.com)\/(?:video\/)?(\d+)/)
  if (match) return `https://player.vimeo.com/video/${match[1]}`
  return null
}

function parseDailymotion(url) {
  const match = url.match(/(?:dailymotion\.com|dai\.ly)\/video\/([\w]+)/)
  if (match) return `https://www.dailymotion.com/embed/video/${match[1]}`
  return null
}

function parseWistia(url) {
  const match = url.match(/wistia\.(?:com|net)\/medias\/([\w]+)/)
  if (match) return `https://fast.wistia.net/embed/iframe/${match[1]}`
  return null
}

function isDirectVideo(url) {
  return /\.(mp4|webm|ogv|ogg|mov|m4v)(\?.*)?$/i.test(url)
}

// Extract src from a full iframe embed code like:
// <iframe src="https://..." ...></iframe>
function extractIframeSrc(value) {
  const match = value.match(/<iframe[^>]*\ssrc\s*=\s*["']([^"']+)["']/i)
  return match ? match[1] : null
}

// Known safe providers don't need ad-blocking / click protection
function isKnownProvider(embedUrl) {
  return (
    embedUrl.includes('youtube.com') ||
    embedUrl.includes('youtu.be') ||
    embedUrl.includes('vimeo.com') ||
    embedUrl.includes('dailymotion.com') ||
    embedUrl.includes('wistia.com') ||
    embedUrl.includes('wistia.net')
  )
}

// Convert any supported URL into a working embed URL
export function toEmbedUrl(url) {
  if (!url) return null
  const trimmed = url.trim()

  // If the value is a full iframe tag, extract its src
  const iframeSrc = extractIframeSrc(trimmed)
  if (iframeSrc) return toEmbedUrl(iframeSrc)

  // Normalize common URL typos (missing protocol)
  let normalized = trimmed
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = `https://${normalized}`
  }

  return (
    parseYouTube(normalized) ||
    parseVimeo(normalized) ||
    parseDailymotion(normalized) ||
    parseWistia(normalized) ||
    normalized
  )
}

export default function VideoPlayer({ url, title = '', className = '' }) {
  const [hideTopBar, setHideTopBar] = useState(true)
  const embedUrl = toEmbedUrl(url)

  if (!embedUrl) {
    return (
      <div className={`w-full h-full flex items-center justify-center bg-gray-900 ${className}`}>
        <p className="text-gray-400">الفيديو غير متوفر حالياً</p>
      </div>
    )
  }

  // Direct video files -> native HTML5 player
  if (isDirectVideo(embedUrl)) {
    return (
      <div className={`relative ${className}`}>
        <video
          src={embedUrl}
          controls
          autoPlay
          playsInline
          className="w-full h-full object-contain bg-black"
          title={title}
        />
      </div>
    )
  }

  const protectedIframe = !isKnownProvider(embedUrl)

  // Everything else -> iframe
  return (
    <div className={`relative ${className}`}>
      <iframe
        src={embedUrl}
        className="w-full h-full bg-black"
        title={title}
        allowFullScreen
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
        {...(protectedIframe
          ? {
              // No allow-top-navigation / allow-popups -> clicks can't redirect away
              sandbox:
                'allow-scripts allow-same-origin allow-presentation allow-forms',
            }
          : {})}
      />

      {/* Overlay strip: hides the top bar / ad buttons / server-select buttons
          (OK, VK, VidSpeed, AstroServers, etc.) inside third-party players */}
      {protectedIframe && (
        <>
          <div
            className={`absolute top-0 right-0 left-0 z-10 flex items-center justify-center bg-black transition-all ${
              hideTopBar ? 'h-14' : 'h-0 pointer-events-none'
            }`}
          >
            <button
              type="button"
              onClick={() => setHideTopBar(false)}
              className="text-white/40 hover:text-white text-xs"
            >
              عرض الشريط
            </button>
          </div>
          {!hideTopBar && (
            <button
              type="button"
              onClick={() => setHideTopBar(true)}
              className="absolute bottom-1 left-1 z-20 text-white/70 hover:text-white text-xs bg-black/60 rounded px-2 py-1"
            >
              إخفاء الشريط
            </button>
          )}
        </>
      )}
    </div>
  )
}
