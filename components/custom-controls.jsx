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
  const [state, setState] = useState({
    playing: false, progress: 0, buffered: 0, currentTime: 0, duration: 0,
    volume: 1, muted: false, showVolume: false, visible: true, fullscreen: false,
    loading: false, showBigPlay: true,
  })
  const [ripple, setRipple] = useState(null)
  const [speed, setSpeed] = useState(null)

  const boxRef = useRef(null)
  const seekRef = useRef(null)
  const hideRef = useRef(null)
  const volHideRef = useRef(null)
  const tapRef = useRef({ t: 0, side: null })
  const singleRef = useRef(null)
  const lpRef = useRef(null)
  const lpActiveRef = useRef(false)
  const lpWasRef = useRef(false)
  const rippleRef = useRef(null)

  const v = videoRef?.current

  const update = useCallback((patch) => setState(s => ({ ...s, ...patch })), [])

  // Video events
  useEffect(() => {
    if (!v) return
    const on = (e, fn) => v.addEventListener(e, fn)
    const off = (e, fn) => v.removeEventListener(e, fn)
    const h = [
      ['play', () => update({ playing: true })],
      ['pause', () => update({ playing: false })],
      ['ended', () => update({ playing: false })],
      ['waiting', () => update({ loading: true })],
      ['canplay', () => update({ loading: false })],
      ['loadeddata', () => update({ showBigPlay: false })],
      ['volumechange', () => update({ volume: v.volume, muted: v.muted })],
      ['durationchange', () => update({ duration: v.duration })],
      ['timeupdate', () => {
        if (v.duration) update({ currentTime: v.currentTime, progress: (v.currentTime / v.duration) * 100 })
      }],
      ['progress', () => {
        if (v.buffered.length > 0 && v.duration) {
          update({ buffered: (v.buffered.end(v.buffered.length - 1) / v.duration) * 100 })
        }
      }],
    ]
    h.forEach(([e, fn]) => on(e, fn))
    return () => h.forEach(([e, fn]) => off(e, fn))
  }, [v, update])

  // Fullscreen
  useEffect(() => {
    const h = () => update({ fullscreen: !!document.fullscreenElement })
    document.addEventListener('fullscreenchange', h)
    return () => document.removeEventListener('fullscreenchange', h)
  }, [update])

  // Auto-hide
  useEffect(() => {
    clearTimeout(hideRef.current)
    if (!state.playing) { update({ visible: true }); return }
    hideRef.current = setTimeout(() => update({ visible: false }), 3000)
    return () => clearTimeout(hideRef.current)
  }, [state.playing, state.visible, update])

  const showUI = useCallback(() => {
    update({ visible: true })
    clearTimeout(hideRef.current)
    if (state.playing) hideRef.current = setTimeout(() => update({ visible: false }), 3000)
  }, [state.playing, update])

  // Actions
  const play = useCallback(() => { if (!v) return; update({ showBigPlay: false }); v.paused ? v.play().catch(() => {}) : v.pause() }, [v, update])
  const skip = useCallback((s) => { if (!v) return; v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + s)) }, [v])
  const toggleMute = useCallback(() => { if (v) v.muted = !v.muted }, [v])
  const toggleFs = useCallback(() => {
    const el = boxRef.current?.parentElement
    if (!el) return
    document.fullscreenElement ? document.exitFullscreen() : el.requestFullscreen()
  }, [])

  // Seek
  const seekTo = useCallback((e) => {
    if (!v || !seekRef.current) return
    const r = seekRef.current.getBoundingClientRect()
    const p = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width))
    v.currentTime = p * (v.duration || 0)
  }, [v])

  const volTo = useCallback((e) => {
    if (!v) return
    const r = e.currentTarget.getBoundingClientRect()
    const p = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width))
    v.volume = p; v.muted = p === 0
  }, [v])

  // Ripple
  const showRipple = useCallback((side) => {
    setRipple(side)
    clearTimeout(rippleRef.current)
    rippleRef.current = setTimeout(() => setRipple(null), 350)
  }, [])

  // Gesture: single/double tap + long press
  const getSide = useCallback((x) => {
    const r = boxRef.current?.getBoundingClientRect()
    return r && (x - r.left) < r.width / 2 ? 'left' : 'right'
  }, [])

  const handleEnd = useCallback((x) => {
    if (lpWasRef.current) { lpWasRef.current = false; return }
    const now = Date.now()
    const side = getSide(x)
    const prev = tapRef.current
    clearTimeout(singleRef.current)
    if (now - prev.t < 300 && prev.side === side) {
      if (side === 'left') skip(-10); else skip(10)
      showRipple(side)
      tapRef.current = { t: 0, side: null }
    } else {
      tapRef.current = { t: now, side }
      singleRef.current = setTimeout(() => play(), 250)
    }
  }, [skip, play, showRipple, getSide])

  const startLP = useCallback(() => {
    lpWasRef.current = false
    clearTimeout(lpRef.current)
    lpRef.current = setTimeout(() => {
      lpWasRef.current = true
      lpActiveRef.current = true
      setSpeed(2)
      if (v) v.playbackRate = 2
    }, 500)
  }, [v])

  const endLP = useCallback(() => {
    clearTimeout(lpRef.current)
    if (lpActiveRef.current) {
      lpActiveRef.current = false
      setSpeed(null)
      if (v) v.playbackRate = 1
    }
  }, [v])

  // Keyboard
  useEffect(() => {
    const h = (e) => {
      if (e.key === ' ') { e.preventDefault(); play() }
      if (e.key === 'ArrowRight') skip(10)
      if (e.key === 'ArrowLeft') skip(-10)
      if (e.key === 'f') toggleFs()
      if (e.key === 'ArrowUp' && v) { e.preventDefault(); v.volume = Math.min(1, v.volume + 0.1) }
      if (e.key === 'ArrowDown' && v) { e.preventDefault(); v.volume = Math.max(0, v.volume - 0.1) }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [play, skip, toggleFs, v])

  return (
    <div
      ref={boxRef}
      className="absolute inset-0 z-10 select-none"
      onMouseMove={showUI}
      onMouseLeave={() => state.playing && update({ visible: false })}
      onMouseDown={startLP}
      onMouseUp={endLP}
      onTouchStart={startLP}
      onTouchEnd={(e) => { endLP(); handleEnd(e.changedTouches[0].clientX) }}
      onTouchMove={() => clearTimeout(lpRef.current)}
      onClick={(e) => handleEnd(e.clientX)}
      onDoubleClick={(e) => {
        if (e.target === boxRef.current) toggleFs()
      }}
    >
      {/* Loading */}
      {state.loading && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <div className="w-10 h-10 border-[3px] border-white/20 border-t-red-500 rounded-full animate-spin" />
        </div>
      )}

      {/* Ripple Left */}
      {ripple === 'left' && (
        <div className="absolute top-1/2 left-[15%] -translate-y-1/2 pointer-events-none z-30 flex flex-col items-center gap-1 opacity-0 animate-[rp_0.35s_ease-out_forwards]">
          <div className="w-11 h-11 rounded-full border border-white/30 bg-white/10 backdrop-blur-sm flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="11 17 6 12 11 7"/><polyline points="18 17 13 12 18 7"/></svg>
          </div>
          <span className="text-white/80 text-[10px] font-medium">10 ثوانٍ</span>
        </div>
      )}

      {/* Ripple Right */}
      {ripple === 'right' && (
        <div className="absolute top-1/2 right-[15%] -translate-y-1/2 pointer-events-none z-30 flex flex-col items-center gap-1 opacity-0 animate-[rp_0.35s_ease-out_forwards]">
          <div className="w-11 h-11 rounded-full border border-white/30 bg-white/10 backdrop-blur-sm flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></svg>
          </div>
          <span className="text-white/80 text-[10px] font-medium">10 ثوانٍ</span>
        </div>
      )}

      {/* Speed */}
      {speed && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-30 bg-red-500/90 backdrop-blur-sm text-white text-sm font-bold px-4 py-2 rounded-full">
          {speed}x ▶▶
        </div>
      )}

      {/* Big Play */}
      {state.showBigPlay && !state.loading && (
        <button onClick={(e) => { e.stopPropagation(); play() }} className="absolute inset-0 flex items-center justify-center z-20">
          <div className="w-16 h-16 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center hover:bg-black/60 transition-all">
            <svg className="w-7 h-7 text-white ml-1" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          </div>
        </button>
      )}

      {/* Controls */}
      <div className={`absolute bottom-0 left-0 right-0 transition-all duration-300 ease-in-out ${state.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3 pointer-events-none'}`}>
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />
        <div className="relative px-3 pb-3 pt-10">
          {/* Seek */}
          <div
            ref={seekRef}
            className="group relative h-5 flex items-center cursor-pointer mb-2"
            onMouseDown={(e) => seekTo(e)}
            onMouseMove={(e) => { if (e.buttons) seekTo(e) }}
          >
            <div className="absolute left-0 right-0 h-[3px] bg-white/20 rounded-full group-hover:h-[5px] transition-all" />
            <div className="absolute left-0 h-[3px] bg-white/30 rounded-full group-hover:h-[5px] transition-all" style={{ width: `${state.buffered}%` }} />
            <div className="absolute left-0 h-[3px] bg-red-500 rounded-full group-hover:h-[5px] transition-all" style={{ width: `${state.progress}%` }} />
            <div className="absolute w-3 h-3 bg-red-500 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity -translate-x-1/2" style={{ left: `${state.progress}%` }} />
          </div>

          {/* Bottom bar */}
          <div className="flex items-center gap-2">
            {/* Play */}
            <button onClick={(e) => { e.stopPropagation(); play() }} className="text-white hover:text-red-400 transition p-1">
              {state.playing ? (
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>
              ) : (
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
              )}
            </button>

            {/* Skip back */}
            <button onClick={(e) => { e.stopPropagation(); skip(-10) }} className="text-white/70 hover:text-white transition p-1">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/><text x="12" y="15.5" fill="currentColor" fontSize="7" fontWeight="bold" textAnchor="middle">10</text></svg>
            </button>

            {/* Skip forward */}
            <button onClick={(e) => { e.stopPropagation(); skip(10) }} className="text-white/70 hover:text-white transition p-1">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z"/><text x="12" y="15.5" fill="currentColor" fontSize="7" fontWeight="bold" textAnchor="middle">10</text></svg>
            </button>

            {/* Time */}
            <span className="text-white/70 text-[11px] font-medium whitespace-nowrap select-none">
              {fmt(state.currentTime)}<span className="text-white/40 mx-0.5">/</span>{fmt(state.duration)}
            </span>

            <div className="flex-1" />

            {/* Speed badge */}
            {speed && <span className="text-red-400 text-[10px] font-bold bg-red-500/10 px-1.5 py-0.5 rounded">{speed}x</span>}

            {/* Volume */}
            <div
              className="flex items-center gap-1"
              onMouseEnter={() => { update({ showVolume: true }); clearTimeout(volHideRef.current) }}
              onMouseLeave={() => { volHideRef.current = setTimeout(() => update({ showVolume: false }), 400) }}
            >
              <button onClick={(e) => { e.stopPropagation(); toggleMute() }} className="text-white/70 hover:text-white transition p-1">
                {state.muted || state.volume === 0 ? (
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>
                ) : state.volume > 0.5 ? (
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
                ) : (
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z"/></svg>
                )}
              </button>
              <div className={`flex items-center overflow-hidden transition-all duration-200 ${state.showVolume ? 'w-20 opacity-100' : 'w-0 opacity-0'}`}>
                <div className="relative w-full h-4 cursor-pointer" onClick={(e) => { e.stopPropagation(); volTo(e) }}>
                  <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-[3px] bg-white/20 rounded-full" />
                  <div className="absolute top-1/2 -translate-y-1/2 left-0 h-[3px] bg-white/70 rounded-full" style={{ width: `${state.muted ? 0 : state.volume * 100}%` }} />
                  <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow -translate-x-1/2" style={{ left: `${state.muted ? 0 : state.volume * 100}%` }} />
                </div>
              </div>
            </div>

            {/* Fullscreen */}
            <button onClick={(e) => { e.stopPropagation(); toggleFs() }} className="text-white/70 hover:text-white transition p-1">
              {state.fullscreen ? (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
