import { useState, useRef, useEffect } from 'react'

const MIN = 1
const MAX = 4
const SWIPE_THRESHOLD = 50

type TouchState =
  | { type: 'none'; startX: number; startY: number }
  | { type: 'pan'; startX: number; startY: number; ox: number; oy: number }
  | { type: 'pinch'; startDist: number; startScale: number; startOx: number; startOy: number; midX: number; midY: number }

export function useImageZoom(
  containerRef: React.RefObject<HTMLDivElement>,
  onSwipeLeft?: () => void,
  onSwipeRight?: () => void,
) {
  const [scale, setScale] = useState(MIN)
  const [offset, setOffset] = useState({ x: 0, y: 0 })

  const scaleRef = useRef(scale)
  const offsetRef = useRef(offset)
  scaleRef.current = scale
  offsetRef.current = offset

  const dragRef = useRef<{ mx: number; my: number; ox: number; oy: number } | null>(null)

  // Stable callback refs so effect closure doesn't go stale
  const cbLeft = useRef(onSwipeLeft)
  const cbRight = useRef(onSwipeRight)
  cbLeft.current = onSwipeLeft
  cbRight.current = onSwipeRight

  // Wheel zoom (desktop)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    function onWheel(e: WheelEvent) {
      if (!el || e.ctrlKey) return
      e.preventDefault()
      const s = scaleRef.current
      const o = offsetRef.current
      const raw = e.deltaMode === 0 ? e.deltaY / 100 : e.deltaY
      const ns = Math.max(MIN, Math.min(MAX, s * Math.exp(-raw * 0.1)))
      if (ns === s) return
      const rect = el.getBoundingClientRect()
      const cx = e.clientX - rect.left - rect.width / 2
      const cy = e.clientY - rect.top - rect.height / 2
      setScale(ns)
      setOffset({ x: ns <= MIN ? 0 : cx - (cx - o.x) * (ns / s), y: ns <= MIN ? 0 : cy - (cy - o.y) * (ns / s) })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [containerRef])

  // Touch: pinch zoom, pan, swipe, double-tap (mobile)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const ts: { current: TouchState | null } = { current: null }
    let lastTapTime = 0

    function dist(a: Touch, b: Touch) {
      return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
    }

    function onTouchStart(e: TouchEvent) {
      if (e.touches.length === 2) {
        e.preventDefault()
        const d = dist(e.touches[0], e.touches[1])
        ts.current = {
          type: 'pinch', startDist: d, startScale: scaleRef.current,
          startOx: offsetRef.current.x, startOy: offsetRef.current.y,
          midX: (e.touches[0].clientX + e.touches[1].clientX) / 2,
          midY: (e.touches[0].clientY + e.touches[1].clientY) / 2,
        }
      } else if (e.touches.length === 1) {
        const t = e.touches[0]
        ts.current = scaleRef.current > MIN
          ? { type: 'pan', startX: t.clientX, startY: t.clientY, ox: offsetRef.current.x, oy: offsetRef.current.y }
          : { type: 'none', startX: t.clientX, startY: t.clientY }
      }
    }

    function onTouchMove(e: TouchEvent) {
      const state = ts.current
      if (!state) return
      if (state.type === 'pan') {
        e.preventDefault()
        const t = e.touches[0]
        setOffset({ x: state.ox + t.clientX - state.startX, y: state.oy + t.clientY - state.startY })
      } else if (state.type === 'pinch' && e.touches.length >= 2) {
        e.preventDefault()
        const d = dist(e.touches[0], e.touches[1])
        const ns = Math.max(MIN, Math.min(MAX, state.startScale * d / state.startDist))
        const rect = el.getBoundingClientRect()
        const cx = state.midX - rect.left - rect.width / 2
        const cy = state.midY - rect.top - rect.height / 2
        setScale(ns)
        setOffset({
          x: ns <= MIN ? 0 : cx - (cx - state.startOx) * (ns / state.startScale),
          y: ns <= MIN ? 0 : cy - (cy - state.startOy) * (ns / state.startScale),
        })
      }
    }

    function onTouchEnd(e: TouchEvent) {
      const state = ts.current
      if (state?.type === 'none' && e.changedTouches.length === 1 && e.touches.length === 0) {
        const t = e.changedTouches[0]
        const dx = t.clientX - state.startX
        const dy = t.clientY - state.startY
        if (Math.abs(dx) >= SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy) * 1.5) {
          if (dx < 0) cbLeft.current?.()
          else cbRight.current?.()
        } else {
          const now = Date.now()
          if (now - lastTapTime < 300 && Math.abs(dx) < 10 && Math.abs(dy) < 10) {
            // Double-tap: toggle zoom
            if (scaleRef.current > MIN) {
              setScale(MIN); setOffset({ x: 0, y: 0 })
            } else {
              const rect = el.getBoundingClientRect()
              const cx = t.clientX - rect.left - rect.width / 2
              const cy = t.clientY - rect.top - rect.height / 2
              setScale(2); setOffset({ x: -cx, y: -cy })
            }
            lastTapTime = 0
          } else {
            lastTapTime = now
          }
        }
      }
      if (e.touches.length === 0) ts.current = null
    }

    el.addEventListener('touchstart', onTouchStart, { passive: false })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [containerRef])

  // Mouse pan (desktop)
  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!dragRef.current) return
      const { mx, my, ox, oy } = dragRef.current
      setOffset({ x: ox + e.clientX - mx, y: oy + e.clientY - my })
    }
    function onUp() { dragRef.current = null }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [])

  function onMouseDown(e: React.MouseEvent) {
    if (scaleRef.current <= MIN) return
    e.preventDefault()
    dragRef.current = { mx: e.clientX, my: e.clientY, ox: offsetRef.current.x, oy: offsetRef.current.y }
  }

  return { scale, offsetX: offset.x, offsetY: offset.y, isZoomed: scale > MIN, onMouseDown }
}
