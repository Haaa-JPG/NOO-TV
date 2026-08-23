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
  const [status, setStatus] = useState('connecting')
  const [peers, setPeers] = useState(0)
  const [downloaded, setDownloaded] = useState(0)
  const [uploaded, setUploaded] = useState(0)
  const onProgressRef = useRef(onProgress)
  const initialTimeRef = useRef(initialTime)

  onProgressRef.current = onProgress
  initialTimeRef.current = initialTime

  useEffect(() => {
    if (!src) return

    let cancelled = false
    let client = null

    const initP2P = async () => {
      try {
        setStatus('connecting')
        
        const WebTorrent = (await import('webtorrent')).default
        client = new WebTorrent({ 
          tracker: { rtcConfig: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] } }
        })
        clientRef.current = client

        client.on('error', (err) => {
          console.error('WebTorrent error:', err)
          if (!cancelled) onError?.(err.message)
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
          setStatus('ready')
          const file = torrent.files.find(f => f.name.endsWith('.mp4') || f.name.endsWith('.mkv') || f.name.endsWith('.webm'))
          if (file) {
            const video = videoRef.current
            if (video) {
              file.renderTo(video, { autoplay: true }, (err) => {
                if (err) {
                  console.error('Render error:', err)
                  onError?.(err.message)
                }
              })
            }
          }
        })

        torrent.on('download', () => {
          if (cancelled) return
          setDownloaded(torrent.downloaded)
          setUploaded(torrent.uploaded)
          const totalPeers = torrent.numPeers
          setPeers(totalPeers)
        })

        torrent.on('wire', (wire) => {
          wire.on('download', () => setPeers(torrent.numPeers))
          wire.on('close', () => setPeers(torrent.numPeers))
        })

      } catch (err) {
        console.error('P2P init failed:', err)
        if (!cancelled) {
          setStatus('error')
          onError?.(err.message)
        }
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
  }, [src, onError])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !initialTimeRef.current) return
    
    const seek = () => {
      if (video.duration && video.duration > 0) {
        video.currentTime = initialTimeRef.current
      }
    }
    video.addEventListener('loadedmetadata', seek)
    return () => video.removeEventListener('loadedmetadata', seek)
  }, [])

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

  return (
    <div className="relative w-full h-full">
      <video
        ref={videoRef}
        controls
        autoPlay
        playsInline
        className="absolute inset-0 w-full h-full object-contain bg-black"
        title={title}
      />
      
      {status === 'connecting' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 border-4 border-red-600/30 rounded-full flex items-center justify-center mx-auto">
              <span className="text-red-400 text-xl">◉</span>
            </div>
            <p className="text-white text-sm">جاري الاتصال بالشبكة الند للند...</p>
            <p className="text-gray-500 text-xs">الزملاء المتصلون: {peers}</p>
          </div>
        </div>
      )}
      
      {status === 'ready' && peers > 0 && (
        <div className="absolute bottom-4 right-4 bg-black/70 text-white text-xs px-2 py-1 rounded flex items-center gap-2">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          P2P نشط: {peers} زملاء
        </div>
      )}
      
      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
          <div className="text-center space-y-2">
            <p className="text-red-400">خطأ في الاتصال P2P</p>
            <p className="text-gray-500 text-sm">سيتم التبديل للبث المباشر...</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default P2PVideoPlayer