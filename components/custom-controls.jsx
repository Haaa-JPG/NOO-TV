'use client'
import { useRef, useState, useEffect, useCallback } from 'react'

function fmt(s) {
  if (!s || !isFinite(s)) return '0:00'
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.floor(s % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${m}:${String(sec).padStart(2, '0')}`
}

export default function CustomControls({ videoRef }) {
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [buffered, setBuffered] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  const [showVolume, setShowVolume] = useState(false)
  const [visible, setVisible] = useState(true)
  const [isFs, setIsFs] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showBigPlay, setShowBigPlay] = useState(true)
  const [ripple, setRipple] = useState(null)
  const [speedLabel, setSpeedLabel] = useState(null)

  const gestureRef = useRef(null)
  const seekRef = useRef(null)
  const wrapRef = useRef(null)
  const hideRef = useRef(null)
  const volHideRef = useRef(null)
  const rippleRef = useRef(null)
  const tapRef = useRef({ t: 0, side: null })
  const singleRef = useRef(null)
  const lpRef = useRef(null)
  const lpOn = useRef(false)

  const v = videoRef?.current

  useEffect(() => {
    if (!v) return
    const a = (e, fn) => v.addEventListener(e, fn)
    const r = (e, fn) => v.removeEventListener(e, fn)
    const h = [
      ['play', () => setPlaying(true)],
      ['pause', () => setPlaying(false)],
      ['ended', () => setPlaying(false)],
      ['waiting', () => setLoading(true)],
      ['canplay', () => setLoading(false)],
      ['loadeddata', () => setShowBigPlay(false)],
      ['volumechange', () => { setVolume(v.volume); setMuted(v.muted) }],
      ['durationchange', () => setDuration(v.duration)],
      ['timeupdate', () => { if (v.duration) { setCurrentTime(v.currentTime); setProgress((v.currentTime / v.duration) * 100) } }],
      ['progress', () => { if (v.buffered.length > 0 && v.duration) setBuffered((v.buffered.end(v.buffered.length - 1) / v.duration) * 100) }],
    ]
    h.forEach(([e, fn]) => a(e, fn))
    return () => h.forEach(([e, fn]) => r(e, fn))
  }, [v])

  useEffect(() => {
    const h = () => setIsFs(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', h)
    return () => document.removeEventListener('fullscreenchange', h)
  }, [])

  useEffect(() => {
    clearTimeout(hideRef.current)
    if (!playing) { setVisible(true); return }
    hideRef.current = setTimeout(() => setVisible(false), 3500)
    return () => clearTimeout(hideRef.current)
  }, [playing, visible])

  useEffect(() => {
    const h = (e) => {
      if (e.key === ' ') { e.preventDefault(); togPlay() }
      if (e.key === 'ArrowRight') skip(10)
      if (e.key === 'ArrowLeft') skip(-10)
      if (e.key === 'f' || e.key === 'F') togFs()
      if (e.key === 'm' || e.key === 'M') { if (v) v.muted = !v.muted }
      if (e.key === 'ArrowUp' && v) { e.preventDefault(); v.volume = Math.min(1, v.volume + 0.1) }
      if (e.key === 'ArrowDown' && v) { e.preventDefault(); v.volume = Math.max(0, v.volume - 0.1) }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [v])

  const togPlay = useCallback(() => { if (!v) return; setShowBigPlay(false); v.paused ? v.play().catch(() => {}) : v.pause() }, [v])
  const skip = useCallback((s) => { if (!v) return; v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + s)) }, [v])
  const togFs = useCallback(() => { const el = wrapRef.current?.parentElement; if (!el) return; document.fullscreenElement ? document.exitFullscreen() : el.requestFullscreen() }, [])

  const seekTo = useCallback((e) => {
    if (!v || !seekRef.current) return
    const r = seekRef.current.getBoundingClientRect()
    v.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * (v.duration || 0)
  }, [v])

  const volTo = useCallback((e) => {
    if (!v) return
    const r = e.currentTarget.getBoundingClientRect()
    const p = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width))
    v.volume = p; v.muted = p === 0
  }, [v])

  const showUI = useCallback(() => {
    setVisible(true)
    clearTimeout(hideRef.current)
    if (playing) hideRef.current = setTimeout(() => setVisible(false), 3500)
  }, [playing])

  const getSide = useCallback((x) => {
    const r = gestureRef.current?.getBoundingClientRect()
    if (!r) return 'center'
    const p = (x - r.left) / r.width
    if (p < 0.33) return 'left'
    if (p > 0.67) return 'right'
    return 'center'
  }, [])

  const showRip = useCallback((side) => {
    setRipple(side)
    clearTimeout(rippleRef.current)
    rippleRef.current = setTimeout(() => setRipple(null), 350)
  }, [])

  const handleGesture = useCallback((clientX) => {
    const now = Date.now()
    const side = getSide(clientX)
    const prev = tapRef.current
    clearTimeout(singleRef.current)

    if (lpOn.current) { lpOn.current = false; return }

    if (now - prev.t < 300 && prev.side === side && side !== 'center') {
      if (side === 'left') skip(-10); else skip(10)
      showRip(side)
      tapRef.current = { t: 0, side: null }
      return
    }

    tapRef.current = { t: now, side }
    if (side === 'center') {
      singleRef.current = setTimeout(() => togPlay(), 280)
    }
  }, [getSide, skip, togPlay, showRip])

  const startLP = useCallback(() => {
    lpOn.current = false
    clearTimeout(lpRef.current)
    lpRef.current = setTimeout(() => { lpOn.current = true; setSpeedLabel('2x'); if (v) v.playbackRate = 2 }, 500)
  }, [v])

  const endLP = useCallback(() => {
    clearTimeout(lpRef.current)
    if (lpOn.current) { lpOn.current = false; setSpeedLabel(null); if (v) v.playbackRate = 1 }
  }, [v])

  const touchIdRef = useRef(null)

  return (
    <>
      <div
        ref={gestureRef}
        className="absolute inset-0 z-[5] select-none touch-manipulation"
        onMouseMove={showUI}
        onMouseLeave={() => playing && setVisible(false)}
        onMouseDown={startLP}
        onMouseUp={endLP}
        onTouchStart={(e) => {
          startLP()
          touchIdRef.current = e.touches[0].identifier
        }}
        onTouchEnd={(e) => {
          endLP()
          const t = Array.from(e.changedTouches).find(ch => ch.identifier === touchIdRef.current)
          if (t) handleGesture(t.clientX)
        }}
        onTouchMove={() => clearTimeout(lpRef.current)}
        onClick={(e) => handleGesture(e.clientX)}
      />

      <div ref={wrapRef} className="absolute inset-0 z-10 pointer-events-none select-none">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-10 h-10 border-[3px] border-white/20 border-t-red-500 rounded-full animate-spin" />
          </div>
        )}

        {ripple === 'left' && (
          <div className="absolute top-1/2 left-[12%] -translate-y-1/2 pointer-events-none flex flex-col items-center gap-1 animate-[rp_0.35s_ease-out_forwards]">
            <div className="w-12 h-12 rounded-full border border-white/30 bg-white/10 backdrop-blur-sm flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><polyline points="11 17 6 12 11 7"/><polyline points="18 17 13 12 18 7"/></svg>
            </div>
            <span className="text-white/80 text-[10px] font-medium">10 ثوانٍ</span>
          </div>
        )}

        {ripple === 'right' && (
          <div className="absolute top-1/2 right-[12%] -translate-y-1/2 pointer-events-none flex flex-col items-center gap-1 animate-[rp_0.35s_ease-out_forwards]">
            <div className="w-12 h-12 rounded-full border border-white/30 bg-white/10 backdrop-blur-sm flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></svg>
            </div>
            <span className="text-white/80 text-[10px] font-medium">10 ثوانٍ</span>
          </div>
        )}

        {speedLabel && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none bg-red-500/90 backdrop-blur-sm text-white text-xs sm:text-sm font-bold px-3 py-1.5 sm:px-4 sm:py-2 rounded-full">
            {speedLabel}x
          </div>
        )}

        {showBigPlay && !loading && (
          <button onClick={togPlay} className="absolute inset-0 flex items-center justify-center pointer-events-auto">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center hover:bg-black/60 active:scale-95 transition-all">
              <svg className="w-6 h-6 sm:w-7 sm:h-7 text-white ml-0.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            </div>
          </button>
        )}

        <div className={`absolute bottom-0 left-0 right-0 transition-all duration-300 ease-in-out ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3 pointer-events-none'}`}>
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />
          <div className="relative px-2 sm:px-3 pb-2 sm:pb-3 pt-8 sm:pt-10 pointer-events-auto">
            <div
              ref={seekRef}
              className="group relative h-4 sm:h-5 flex items-center cursor-pointer mb-1.5 sm:mb-2"
              onMouseDown={(e) => { e.stopPropagation(); seekTo(e) }}
              onMouseMove={(e) => { if (e.buttons === 1) seekTo(e) }}
            >
              <div className="absolute left-0 right-0 h-[3px] bg-white/20 rounded-full group-hover:h-[5px] transition-all" />
              <div className="absolute left-0 h-[3px] bg-white/30 rounded-full group-hover:h-[5px] transition-all" style={{ width: `${buffered}%` }} />
              <div className="absolute left-0 h-[3px] bg-red-500 rounded-full group-hover:h-[5px] transition-all" style={{ width: `${progress}%` }} />
              <div className="absolute w-2.5 h-2.5 sm:w-3 sm:h-3 bg-red-500 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity -translate-x-1/2" style={{ left: `${progress}%` }} />
            </div>

            <div className="flex items-center gap-0.5 sm:gap-1">
              <button onClick={(e) => { e.stopPropagation(); togPlay() }} className="text-white hover:text-red-400 transition p-1 sm:p-1.5">
                {playing ? (
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>
                ) : (
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                )}
              </button>

              <button onClick={(e) => { e.stopPropagation(); skip(-10) }} className="text-white/60 hover:text-white transition p-1 sm:p-1.5 hidden sm:block">
                <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/><text x="12" y="16" fill="white" fontSize="7" fontWeight="bold" textAnchor="middle">10</text></svg>
              </button>

              <button onClick={(e) => { e.stopPropagation(); skip(10) }} className="text-white/60 hover:text-white transition p-1 sm:p-1.5 hidden sm:block">
                <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z"/><text x="12" y="16" fill="white" fontSize="7" fontWeight="bold" textAnchor="middle">10</text></svg>
              </button>

              <span className="text-white/70 text-[10px] sm:text-[11px] font-medium whitespace-nowrap select-none px-1 sm:px-1.5">
                {fmt(currentTime)}<span className="text-white/30">/</span>{fmt(duration)}
              </span>

              <div className="flex-1" />

              <div
                className="hidden sm:flex items-center"
                onMouseEnter={() => { setShowVolume(true); clearTimeout(volHideRef.current) }}
                onMouseLeave={() => { volHideRef.current = setTimeout(() => setShowVolume(false), 400) }}
              >
                <button onClick={(e) => { e.stopPropagation(); if (v) v.muted = !v.muted }} className="text-white/60 hover:text-white transition p-1 sm:p-1.5">
                  {muted || volume === 0 ? (
                    <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>
                  ) : volume > 0.5 ? (
                    <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
                  ) : (
                    <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z"/></svg>
                  )}
                </button>
                <div className={`flex items-center overflow-hidden transition-all duration-200 ${showVolume ? 'w-16 sm:w-20 opacity-100' : 'w-0 opacity-0'}`}>
                  <div className="relative w-full h-4 cursor-pointer" onClick={(e) => { e.stopPropagation(); volTo(e) }}>
                    <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-[3px] bg-white/20 rounded-full" />
                    <div className="absolute top-1/2 -translate-y-1/2 left-0 h-[3px] bg-white/70 rounded-full" style={{ width: `${muted ? 0 : volume * 100}%` }} />
                    <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow -translate-x-1/2" style={{ left: `${muted ? 0 : volume * 100}%` }} />
                  </div>
                </div>
              </div>

              <button onClick={(e) => { e.stopPropagation(); togFs() }} className="text-white/60 hover:text-white transition p-1 sm:p-1.5">
                {isFs ? (
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>
                ) : (
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
