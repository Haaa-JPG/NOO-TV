'use client'

import { useRef, useEffect, useState, useCallback } from 'react'

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
  const [speed, setSpeed] = useState(1)
  const [showSpeedMenu, setShowSpeedMenu] = useState(false)

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
    <div className="absolute inset-0 w-full h-full bg-black">
      <video
        ref={videoRef}
        controls
        autoPlay
        playsInline
        className="absolute inset-0 w-full h-full object-contain"
        title={title}
      />
      <div className="absolute top-3 left-3 z-10">
        <button
          onClick={() => setShowSpeedMenu(!showSpeedMenu)}
          className="bg-black/70 hover:bg-black/90 text-white text-xs px-2.5 py-1.5 rounded-lg backdrop-blur-sm border border-white/20 transition"
        >
          {speed}x
        </button>
        {showSpeedMenu && (
          <div className="absolute top-full left-0 mt-1 bg-black/90 rounded-lg border border-white/20 overflow-hidden backdrop-blur-sm">
            {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 2].map(s => (
              <button
                key={s}
                onClick={() => {
                  setSpeed(s)
                  if (videoRef.current) videoRef.current.playbackRate = s
                  setShowSpeedMenu(false)
                }}
                className={`block w-full text-right px-4 py-1.5 text-xs hover:bg-white/20 transition ${speed === s ? 'text-red-500 font-bold' : 'text-white'}`}
              >
                {s}x
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default P2PVideoPlayer