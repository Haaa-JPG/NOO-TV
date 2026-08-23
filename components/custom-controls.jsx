'use client'
import { useRef, useState, useEffect, useCallback } from 'react'

function formatTime(s) {
  if (!s || !isFinite(s)) return '0:00'
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.floor(s % 60)
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export default function CustomControls({ videoRef, className = '' }) {
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [buffered, setBuffered] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  const [showVolume, setShowVolume] = useState(false)
  const [visible, setVisible] = useState(true)
  const [fullscreen, setFullscreen] = useState(false)
  const [seeking, setSeeking] = useState(false)
  const [seekPreview, setSeekPreview] = useState(null)
  const [seekPreviewPos, setSeekPreviewPos] = useState(0)
  const [showBigPlay, setShowBigPlay] = useState(true)
  const [loading, setLoading] = useState(false)
  const [longPressing, setLongPressing] = useState(false)
  const [ripple, setRipple] = useState(null)

  const containerRef = useRef(null)
  const seekRef = useRef(null)
  const hideTimer = useRef(null)
  const volumeTimer = useRef(null)
  const singleTapTimer = useRef(null)
  const lastTapRef = useRef({ time: 0, side: null })
  const longPressTimer = useRef(null)
  const longPressActiveRef = useRef(false)
  const wasLongPressRef = useRef(false)
  const rippleTimer = useRef(null)

  const video = videoRef?.current

  const showControls = useCallback(() => {
    setVisible(true)
    clearTimeout(hideTimer.current)
    if (playing) {
      hideTimer.current = setTimeout(() => setVisible(false), 3000)
    }
  }, [playing])

  useEffect(() => {
    if (!playing) {
      setVisible(true)
      clearTimeout(hideTimer.current)
    } else {
      hideTimer.current = setTimeout(() => setVisible(false), 3000)
    }
    return () => clearTimeout(hideTimer.current)
  }, [playing])

  useEffect(() => {
    if (!video) return
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onTimeUpdate = () => {
      if (!seeking) {
        setCurrentTime(video.currentTime)
        setProgress(video.duration ? (video.currentTime / video.duration) * 100 : 0)
      }
    }
    const onDurationChange = () => setDuration(video.duration)
    const onProgress = () => {
      if (video.buffered.length > 0) {
        setBuffered((video.buffered.end(video.buffered.length - 1) / video.duration) * 100)
      }
    }
    const onWaiting = () => setLoading(true)
    const onCanPlay = () => setLoading(false)
    const onVolumeChange = () => { setVolume(video.volume); setMuted(video.muted) }
    const onEnded = () => setPlaying(false)
    const onLoadedData = () => setShowBigPlay(false)

    video.addEventListener('play', onPlay)
    video.addEventListener('pause', onPause)
    video.addEventListener('timeupdate', onTimeUpdate)
    video.addEventListener('durationchange', onDurationChange)
    video.addEventListener('progress', onProgress)
    video.addEventListener('waiting', onWaiting)
    video.addEventListener('canplay', onCanPlay)
    video.addEventListener('volumechange', onVolumeChange)
    video.addEventListener('ended', onEnded)
    video.addEventListener('loadeddata', onLoadedData)

    return () => {
      video.removeEventListener('play', onPlay)
      video.removeEventListener('pause', onPause)
      video.removeEventListener('timeupdate', onTimeUpdate)
      video.removeEventListener('durationchange', onDurationChange)
      video.removeEventListener('progress', onProgress)
      video.removeEventListener('waiting', onWaiting)
      video.removeEventListener('canplay', onCanPlay)
      video.removeEventListener('volumechange', onVolumeChange)
      video.removeEventListener('ended', onEnded)
      video.removeEventListener('loadeddata', onLoadedData)
    }
  }, [video, seeking])

  useEffect(() => {
    const onFsChange = () => setFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  const togglePlay = useCallback(() => {
    if (!video) return
    setShowBigPlay(false)
    if (video.paused) video.play().catch(() => {})
    else video.pause()
  }, [video])

  const handleSeek = useCallback((e) => {
    if (!video || !seekRef.current) return
    const rect = seekRef.current.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    video.currentTime = pct * (video.duration || 0)
    setProgress(pct * 100)
    setCurrentTime(video.currentTime)
    setSeeking(false)
  }, [video])

  const handleSeekStart = useCallback((e) => { setSeeking(true); handleSeek(e) }, [handleSeek])

  const handleSeekMove = useCallback((e) => {
    if (!seekRef.current) return
    const rect = seekRef.current.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    setSeekPreview(formatTime(pct * (duration || 0)))
    setSeekPreviewPos(pct * 100)
  }, [duration])

  const handleSeekEnd = useCallback(() => setSeeking(false), [])

  const toggleMute = useCallback(() => { if (video) video.muted = !video.muted }, [video])

  const handleVolume = useCallback((e) => {
    if (!video) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    video.volume = pct
    video.muted = pct === 0
  }, [video])

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current?.parentElement
    if (!el) return
    if (document.fullscreenElement) document.exitFullscreen()
    else el.requestFullscreen()
  }, [])

  const skip = useCallback((sec) => {
    if (!video) return
    video.currentTime = Math.max(0, Math.min(video.duration || 0, video.currentTime + sec))
  }, [video])

  const showRipple = useCallback((side) => {
    setRipple(side)
    clearTimeout(rippleTimer.current)
    rippleTimer.current = setTimeout(() => setRipple(null), 400)
  }, [])

  const getSide = useCallback((clientX) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return 'right'
    return (clientX - rect.left) < rect.width / 2 ? 'left' : 'right'
  }, [])

  // Single tap / double tap handler
  const handleGestureEnd = useCallback((clientX) => {
    if (wasLongPressRef.current) {
      wasLongPressRef.current = false
      return
    }

    const now = Date.now()
    const side = getSide(clientX)
    const prev = lastTapRef.current
    const isDoubleTap = now - prev.time < 300 && prev.side === side

    clearTimeout(singleTapTimer.current)

    if (isDoubleTap) {
      // Double tap - skip
      if (side === 'left') skip(-10)
      else skip(10)
      showRipple(side)
      lastTapRef.current = { time: 0, side: null }
    } else {
      // Potential single tap - delay to check for double
      lastTapRef.current = { time: now, side }
      singleTapTimer.current = setTimeout(() => {
        togglePlay()
      }, 300)
    }
  }, [skip, togglePlay, showRipple, getSide])

  // Keyboard
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === ' ') { e.preventDefault(); togglePlay() }
      if (e.key === 'ArrowRight') skip(10)
      if (e.key === 'ArrowLeft') skip(-10)
      if (e.key === 'f') toggleFullscreen()
      if (e.key === 'ArrowUp') { e.preventDefault(); if (video) video.volume = Math.min(1, video.volume + 0.1) }
      if (e.key === 'ArrowDown') { e.preventDefault(); if (video) video.volume = Math.max(0, video.volume - 0.1) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [togglePlay, skip, toggleFullscreen, video])

  const startLongPress = useCallback(() => {
    wasLongPressRef.current = false
    clearTimeout(longPressTimer.current)
    longPressTimer.current = setTimeout(() => {
      wasLongPressRef.current = true
      longPressActiveRef.current = true
      setLongPressing(true)
      if (video) video.playbackRate = 2
    }, 500)
  }, [video])

  const endLongPress = useCallback(() => {
    clearTimeout(longPressTimer.current)
    if (longPressActiveRef.current) {
      longPressActiveRef.current = false
      setLongPressing(false)
      if (video) { video.playbackRate = 1 }
    }
  }, [video])

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 z-10 select-none ${className}`}
      onMouseMove={showControls}
      onMouseLeave={() => { if (playing) setVisible(false) }}
      onClick={(e) => handleGestureEnd(e.clientX)}
      onTouchStart={(e) => { startLongPress() }}
      onTouchEnd={(e) => {
        endLongPress()
        handleGestureEnd(e.changedTouches[0].clientX)
      }}
      onTouchMove={() => { clearTimeout(longPressTimer.current) }}
      onMouseDown={() => startLongPress()}
      onMouseUp={endLongPress}
    >
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <div className="w-10 h-10">
            <div className="absolute inset-0 border-[3px] border-white/20 rounded-full" />
            <div className="absolute inset-0 border-[3px] border-transparent border-t-red-500 rounded-full animate-spin" />
          </div>
        </div>
      )}

      {/* Ripple - LEFT */}
      {ripple === 'left' && (
        <div className="absolute top-1/2 left-20 -translate-y-1/2 -translate-x-1/2 pointer-events-none z-30 flex items-center gap-1 animate-[rippleFade_0.4s_ease-out_forwards]">
          <div className="w-10 h-10 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center">
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="11 17 6 12 11 7"/>
              <polyline points="18 17 13 12 18 7"/>
            </svg>
          </div>
          <span className="text-white/90 text-[11px] font-semibold">10 ثوانٍ</span>
        </div>
      )}

      {/* Ripple - RIGHT */}
      {ripple === 'right' && (
        <div className="absolute top-1/2 right-20 -translate-y-1/2 translate-x-1/2 pointer-events-none z-30 flex items-center gap-1 animate-[rippleFade_0.4s_ease-out_forwards]">
          <span className="text-white/90 text-[11px] font-semibold">10 ثوانٍ</span>
          <div className="w-10 h-10 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center">
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="13 17 18 12 13 7"/>
              <polyline points="6 17 11 12 6 7"/>
            </svg>
          </div>
        </div>
      )}

      {/* Long press speed */}
      {longPressing && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-30">
          <div className="bg-red-500/80 backdrop-blur-sm text-white text-xs font-bold px-3 py-1.5 rounded-full animate-pulse">
            2x ▶▶
          </div>
        </div>
      )}

      {showBigPlay && !loading && (
        <button
          onClick={(e) => { e.stopPropagation(); togglePlay() }}
          className="absolute inset-0 flex items-center justify-center z-20"
        >
          <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center transition hover:bg-white/20 hover:scale-105">
            <svg className="w-7 h-7 text-white ml-0.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </div>
        </button>
      )}

      <div
        className={`absolute bottom-0 left-0 right-0 transition-all duration-300 ${
          visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none" />
        <div className="relative px-4 pb-4 pt-12">
          <div
            ref={seekRef}
            className="group/seek relative h-6 flex items-center cursor-pointer mb-3"
            onMouseDown={handleSeekStart}
            onMouseMove={(e) => handleSeekMove(e)}
            onMouseUp={handleSeekEnd}
            onMouseLeave={handleSeekEnd}
          >
            <div className="absolute left-0 right-0 h-1 bg-white/20 rounded-full group-hover/seek:h-1.5 transition-all" />
            <div className="absolute left-0 h-1 bg-white/30 rounded-full group-hover/seek:h-1.5 transition-all" style={{ width: `${buffered}%` }} />
            <div className="absolute left-0 h-1 bg-red-500 rounded-full group-hover/seek:h-1.5 transition-all" style={{ width: `${progress}%` }} />
            <div className="absolute w-3 h-3 bg-red-500 rounded-full shadow-lg opacity-0 group-hover/seek:opacity-100 transition -translate-x-1/2" style={{ left: `${progress}%` }} />
            {seekPreview && (
              <div className="absolute bottom-8 -translate-x-1/2 bg-black/80 backdrop-blur-sm text-white text-xs px-2 py-1 rounded pointer-events-none" style={{ left: `${seekPreviewPos}%` }}>
                {seekPreview}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button onClick={(e) => { e.stopPropagation(); togglePlay() }} className="text-white/90 hover:text-white transition flex-shrink-0">
              {playing ? (
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>
              ) : (
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
              )}
            </button>

            <button onClick={(e) => { e.stopPropagation(); skip(-10) }} className="text-white/70 hover:text-white transition flex-shrink-0">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12.5 8.5l-4 3.5 4 3.5"/><path d="M17 5v4h-4"/>
                <text x="12" y="15.5" fill="currentColor" stroke="none" fontSize="7" fontWeight="bold" textAnchor="middle">10</text>
              </svg>
            </button>

            <button onClick={(e) => { e.stopPropagation(); skip(10) }} className="text-white/70 hover:text-white transition flex-shrink-0">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11.5 8.5l4 3.5-4 3.5"/><path d="M7 5v4h4"/>
                <text x="12" y="15.5" fill="currentColor" stroke="none" fontSize="7" fontWeight="bold" textAnchor="middle">10</text>
              </svg>
            </button>

            <span className="text-white/80 text-xs font-medium tracking-wide whitespace-nowrap select-none">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>

            <div className="flex-1" />

            <div
              className="relative flex items-center gap-2"
              onMouseEnter={() => { setShowVolume(true); clearTimeout(volumeTimer.current) }}
              onMouseLeave={() => { volumeTimer.current = setTimeout(() => setShowVolume(false), 500) }}
            >
              <button onClick={(e) => { e.stopPropagation(); toggleMute() }} className="text-white/70 hover:text-white transition">
                {muted || volume === 0 ? (
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>
                ) : volume > 0.5 ? (
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
                ) : (
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z"/></svg>
                )}
              </button>
              <div className={`flex items-center overflow-hidden transition-all duration-200 ${showVolume ? 'w-20 opacity-100' : 'w-0 opacity-0'}`}>
                <div className="relative w-full h-5 flex items-center cursor-pointer" onClick={(e) => { e.stopPropagation(); handleVolume(e) }}>
                  <div className="absolute left-0 right-0 h-0.5 bg-white/20 rounded-full" />
                  <div className="absolute left-0 h-0.5 bg-white/70 rounded-full" style={{ width: `${muted ? 0 : volume * 100}%` }} />
                  <div className="absolute w-2.5 h-2.5 bg-white rounded-full shadow -translate-x-1/2" style={{ left: `${muted ? 0 : volume * 100}%` }} />
                </div>
              </div>
            </div>

            <button onClick={(e) => { e.stopPropagation(); toggleFullscreen() }} className="text-white/70 hover:text-white transition flex-shrink-0">
              {fullscreen ? (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>
              )}
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes rippleFade {
          0% { opacity: 1; transform: translateY(-50%) translateX(-50%) scale(0.7); }
          50% { opacity: 1; transform: translateY(-50%) translateX(-50%) scale(1); }
          100% { opacity: 0; transform: translateY(-50%) translateX(-50%) scale(1.1); }
        }
      `}</style>
    </div>
  )
}
