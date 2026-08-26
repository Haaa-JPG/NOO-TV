'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import CustomControls from './custom-controls'

function LongPressFF({ videoRef }) {
  const [ff, setFf] = useState(false)
  const timer = useRef(null)
  const active = useRef(false)

  const start = useCallback((e) => {
    if (e.target.closest('button') || e.target.closest('input')) return
    active.current = false
    timer.current = setTimeout(() => {
      active.current = true
      setFf(true)
      if (videoRef?.current) videoRef.current.playbackRate = 2
    }, 500)
  }, [videoRef])

  const stop = useCallback(() => {
    clearTimeout(timer.current)
    if (active.current) {
      setFf(false)
      if (videoRef?.current) videoRef.current.playbackRate = 1
    }
  }, [videoRef])

  return (
    <div className="relative w-full h-full" onMouseDown={start} onMouseUp={stop} onMouseLeave={stop} onTouchStart={start} onTouchEnd={stop} onTouchCancel={stop}>
      {ff && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/70 text-white px-3 py-1 rounded-full text-sm font-bold z-50 pointer-events-none flex items-center gap-1">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>
          2x
        </div>
      )}
    </div>
  )
}

const TRACKERS = [
  'wss://tracker.openwebtorrent.com',
  'wss://tracker.btorrent.xyz',
  'wss://tracker.webtorrent.dev',
]

function P2PVideoPlayer({ 
  src, 
  title, 
  initialTime = 0, 
  onProgress,
  onError 
}) {
  const videoRef = useRef(null)
  const clientRef = useRef(null)
  const torrentRef = useRef(null)
  const p2pActiveRef = useRef(false)
  const onProgressRef = useRef(onProgress)
  const initialTimeRef = useRef(initialTime)

  onProgressRef.current = onProgress
  initialTimeRef.current = initialTime

  // Play video immediately via direct HTTP (silent fallback)
  useEffect(() => {
    const video = videoRef.current
    if (!video || !src) return
    video.src = src
    video.load()
  }, [src])

  // Background P2P - completely silent, no UI
  useEffect(() => {
    if (!src) return

    let cancelled = false
    let client = null

    const initP2P = async () => {
      try {
        const WebTorrent = (await import('webtorrent')).default
        client = new WebTorrent({ 
          tracker: { rtcConfig: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] } }
        })
        clientRef.current = client

        client.on('error', (err) => {
          console.debug('WebTorrent error (silent):', err.message)
        })

        const torrent = await new Promise((resolve, reject) => {
          client.add(src, { path: '/' }, (torrent) => {
            if (cancelled) {
              torrent.destroy()
              reject(new Error('Cancelled'))
              return
            }
            torrentRef.current = torrent
            resolve(torrent)
          })
        })

        if (cancelled) return

        torrent.on('ready', () => {
          if (cancelled) return
          const file = torrent.files.find(f => f.name.endsWith('.mp4') || f.name.endsWith('.mkv') || f.name.endsWith('.webm'))
          if (file && videoRef.current) {
            // Try to render via P2P - if it works, video will switch seamlessly
            file.renderTo(videoRef.current, { autoplay: true }, (err) => {
              if (!err) {
                p2pActiveRef.current = true
                console.debug('P2P streaming active')
              }
            })
          }
        })

      } catch (err) {
        console.debug('P2P init failed (silent):', err.message)
      }
    }

    initP2P()

    return () => {
      cancelled = true
      if (torrentRef.current) {
        torrentRef.current.destroy()
        torrentRef.current = null
      }
      if (client) {
        client.destroy()
        clientRef.current = null
      }
    }
  }, [src])

  // Seek to initial time
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

  // Progress tracking
  useEffect(() => {
    const video = videoRef.current
    if (!video || !onProgressRef.current) return
    
    let lastSave = 0
    const handler = () => {
      const now = Date.now()
      if (now - lastSave > 10000) {
        lastSave = now
        onProgressRef.current(Math.floor(video.currentTime), Math.floor(video.duration || 0))
      }
    }
    const handleEnded = () => {
      onProgressRef.current(0, Math.floor(video.duration || 0), true)
    }
    video.addEventListener('timeupdate', handler)
    video.addEventListener('ended', handleEnded)
    return () => {
      video.removeEventListener('timeupdate', handler)
      video.removeEventListener('ended', handleEnded)
    }
  }, [])

  // Clean render - NO P2P UI AT ALL
  return (
    <div className="relative w-full h-full">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="absolute inset-0 w-full h-full object-contain bg-black"
        title={title}
      />
      <CustomControls videoRef={videoRef} />
      <LongPressFF videoRef={videoRef} />
    </div>
  )
}

export default P2PVideoPlayer