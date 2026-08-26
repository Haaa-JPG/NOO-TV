'use client'

import { useRef, useState, useEffect, useCallback } from 'react'

function formatTime(sec) {
  if (!sec || isNaN(sec)) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function CustomControls({ videoRef }) {
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  const [showUI, setShowUI] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [buffered, setBuffered] = useState(0)
  const [speed, setSpeed] = useState(1)
  const [showVolume, setShowVolume] = useState(false)
  const hideTimer = useRef(null)
  const lastTap = useRef(0)
  const touchStartY = useRef(0)

  const video = videoRef?.current

  useEffect(() => {
    if (!video) return
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onTime = () => {
      setCurrentTime(video.currentTime)
      if (video.buffered.length > 0) {
        setBuffered(video.buffered.end(video.buffered.length - 1))
      }
    }
    const onDur = () => setDuration(video.duration)
    const onVol = () => { setVolume(video.volume); setMuted(video.muted) }
    const onEnd = () => setPlaying(false)

    video.addEventListener('play', onPlay)
    video.addEventListener('pause', onPause)
    video.addEventListener('timeupdate', onTime)
    video.addEventListener('loadedmetadata', onDur)
    video.addEventListener('volumechange', onVol)
    video.addEventListener('ended', onEnd)

    if (!video.paused) setPlaying(true)

    return () => {
      video.removeEventListener('play', onPlay)
      video.removeEventListener('pause', onPause)
      video.removeEventListener('timeupdate', onTime)
      video.removeEventListener('loadedmetadata', onDur)
      video.removeEventListener('volumechange', onVol)
      video.removeEventListener('ended', onEnd)
    }
  }, [video])

  const scheduleHide = useCallback(() => {
    clearTimeout(hideTimer.current)
    if (playing) {
      hideTimer.current = setTimeout(() => setShowUI(false), 3500)
    }
  }, [playing])

  useEffect(() => {
    if (playing) scheduleHide()
    else { setShowUI(true); clearTimeout(hideTimer.current) }
    return () => clearTimeout(hideTimer.current)
  }, [playing, scheduleHide])

  const show = useCallback(() => {
    setShowUI(true)
    scheduleHide()
  }, [scheduleHide])

  const togglePlay = useCallback(() => {
    if (!video) return
    if (video.paused) { video.play() } else { video.pause() }
  }, [video])

  const seek = (e) => {
    if (!video) return
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    video.currentTime = pct * (video.duration || 0)
    show()
  }

  const toggleMute = () => {
    if (!video) return
    video.muted = !video.muted
    setMuted(video.muted)
  }

  const changeVolume = (e) => {
    if (!video) return
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    video.volume = pct
    video.muted = pct === 0
    setVolume(pct)
    setMuted(pct === 0)
  }

  const toggleFullscreen = () => {
    const el = video?.closest('.relative')
    if (!el) return
    if (document.fullscreenElement) {
      document.exitFullscreen()
      setIsFullscreen(false)
    } else {
      el.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {})
    }
  }

  const changeSpeed = () => {
    const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2]
    const idx = speeds.indexOf(speed)
    const next = speeds[(idx + 1) % speeds.length]
    if (video) video.playbackRate = next
    setSpeed(next)
  }

  const skip = (sec) => {
    if (!video) return
    e.stopPropagation()
    video.currentTime = Math.max(0, Math.min(video.duration || 0, video.currentTime + sec))
    show()
  }

  const handleTap = (e) => {
    e.stopPropagation()
    const now = Date.now()
    if (now - lastTap.current < 300) {
      toggleFullscreen()
      lastTap.current = 0
    } else {
      lastTap.current = now
      togglePlay()
    }
  }

  const handleTouchStart = (e) => {
    touchStartY.current = e.touches[0].clientY
  }

  const handleTouchMove = (e) => {
    if (!video) return
    const diff = touchStartY.current - e.touches[0].clientY
    if (Math.abs(diff) > 30) {
      if (diff > 0) video.volume = Math.min(1, video.volume + 0.05)
      else video.volume = Math.max(0, video.volume - 0.05)
      setVolume(video.volume)
    }
  }

  const pct = duration > 0 ? (currentTime / duration) * 100 : 0
  const bufPct = duration > 0 ? (buffered / duration) * 100 : 0

  return (
    <div className="absolute inset-0 z-40 select-none" onMouseMove={show} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove}>
      {/* Tap area - covers full video */}
      <div className="absolute inset-0" onClick={handleTap} />

      {/* Top gradient */}
      <div className={`absolute top-0 left-0 right-0 h-14 bg-gradient-to-b from-black/70 to-transparent pointer-events-none transition-opacity duration-300 ${showUI ? 'opacity-100' : 'opacity-0'}`} />

      {/* Center play/pause indicator - only when paused */}
      {!playing && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50">
          <div className="w-16 h-16 bg-red-600/90 rounded-full flex items-center justify-center shadow-2xl">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>
          </div>
        </div>
      )}

      {/* Bottom controls */}
      <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-3 pb-2 pt-10 transition-opacity duration-300 ${showUI ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        {/* Seek bar */}
        <div className="relative w-full h-8 flex items-center cursor-pointer group" onClick={seek}>
          <div className="absolute w-full h-1 bg-white/30 rounded-full group-hover:h-1.5 transition-all">
            <div className="h-full bg-red-600 rounded-full relative" style={{ width: `${pct}%` }}>
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-red-600 rounded-full opacity-0 group-hover:opacity-100 transition shadow-lg" />
            </div>
            <div className="absolute h-full bg-white/20 rounded-full" style={{ width: `${bufPct}%` }} />
          </div>
        </div>

        {/* Controls row */}
        <div className="flex items-center justify-between gap-1 -mt-1">
          <div className="flex items-center gap-0.5">
            {/* Play/Pause */}
            <button onClick={(e) => { e.stopPropagation(); togglePlay(); show() }} className="w-10 h-10 flex items-center justify-center hover:bg-white/10 rounded-full active:bg-white/20 transition">
              {playing ? (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>
              )}
            </button>

            {/* Skip -10s */}
            <button onClick={(e) => { e.stopPropagation(); if(video){video.currentTime=Math.max(0,video.currentTime-10)} show() }} className="w-10 h-10 flex items-center justify-center hover:bg-white/10 rounded-full active:bg-white/20 transition">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                <path d="M11.99 5V1l-5 5 5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6h-2c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
                <text x="9" y="16" fontSize="7" fill="white" fontWeight="bold">10</text>
              </svg>
            </button>

            {/* Skip +10s */}
            <button onClick={(e) => { e.stopPropagation(); if(video){video.currentTime=Math.min(video.duration||0,video.currentTime+10)} show() }} className="w-10 h-10 flex items-center justify-center hover:bg-white/10 rounded-full active:bg-white/20 transition">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                <path d="M12.01 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z"/>
                <text x="8.5" y="16" fontSize="7" fill="white" fontWeight="bold">10</text>
              </svg>
            </button>

            {/* Volume */}
            <div className="relative" onMouseEnter={() => setShowVolume(true)} onMouseLeave={() => setShowVolume(false)}>
              <button onClick={(e) => { e.stopPropagation(); toggleMute(); show() }} className="w-10 h-10 flex items-center justify-center hover:bg-white/10 rounded-full active:bg-white/20 transition">
                {muted || volume === 0 ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>
                ) : volume > 0.5 ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z"/></svg>
                )}
              </button>
              {/* Volume slider */}
              {showVolume && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-black/90 rounded-lg p-2" onClick={(e) => e.stopPropagation()}>
                  <div className="w-8 h-32 relative cursor-pointer" onClick={changeVolume}>
                    <div className="absolute bottom-0 w-full bg-white/30 rounded-full" style={{ height: '100%' }} />
                    <div className="absolute bottom-0 w-full bg-red-600 rounded-full" style={{ height: `${volume * 100}%` }} />
                  </div>
                </div>
              )}
            </div>

            {/* Time */}
            <span className="text-white text-xs font-mono mx-1 hidden sm:inline">{formatTime(currentTime)} / {formatTime(duration)}</span>
          </div>

          <div className="flex items-center gap-0.5">
            {/* Speed */}
            <button onClick={(e) => { e.stopPropagation(); changeSpeed(); show() }} className="px-2 h-8 flex items-center justify-center hover:bg-white/10 rounded active:bg-white/20 transition text-white text-xs font-bold min-w-[36px]">
              {speed}x
            </button>

            {/* Fullscreen */}
            <button onClick={(e) => { e.stopPropagation(); toggleFullscreen(); show() }} className="w-10 h-10 flex items-center justify-center hover:bg-white/10 rounded-full active:bg-white/20 transition">
              {isFullscreen ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
