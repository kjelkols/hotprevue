import { useState, useRef, useEffect } from 'react'

const MIN = 1
const MAX = 4

export function useZoomPan(
  containerRef: React.RefObject<HTMLDivElement>,
  imageRef: React.RefObject<HTMLImageElement>,
) {
  const [scale, setScale] = useState(MIN)
  const [offset, setOffset] = useState({ x: 0, y: 0 })

  const scaleRef = useRef(scale)
  const offsetRef = useRef(offset)
  scaleRef.current = scale
  offsetRef.current = offset

  const dragRef = useRef<{ mx: number; my: number; ox: number; oy: number } | null>(null)

  // Clamp offset so the image edge never moves past the container edge.
  function clampOffset(ox: number, oy: number, s: number) {
    const c = containerRef.current
    const img = imageRef.current
    if (!c || !img || !img.naturalWidth) return { x: ox, y: oy }
    const W = c.clientWidth, H = c.clientHeight
    const ar = img.naturalWidth / img.naturalHeight
    const rw = ar > W / H ? W : H * ar   // rendered width at scale 1
    const rh = ar > W / H ? W / ar : H   // rendered height at scale 1
    const maxX = Math.max(0, (rw * s - W) / 2)
    const maxY = Math.max(0, (rh * s - H) / 2)
    return { x: Math.max(-maxX, Math.min(maxX, ox)), y: Math.max(-maxY, Math.min(maxY, oy)) }
  }

  // Non-passive wheel listener — zoom toward cursor with deltaMode normalization.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    function onWheel(e: WheelEvent) {
      if (!el) return
      e.preventDefault()
      const s = scaleRef.current
      const o = offsetRef.current
      // Normalize: pixel mode (trackpad) has large deltaY; line mode (mouse wheel) has small deltaY.
      const raw = e.deltaMode === 0 ? e.deltaY / 100 : e.deltaY
      const ns = Math.max(MIN, Math.min(MAX, s * Math.exp(-raw * 0.1)))
      if (ns === s) return
      const rect = el.getBoundingClientRect()
      const cx = e.clientX - rect.left - rect.width / 2
      const cy = e.clientY - rect.top - rect.height / 2
      const nx = ns <= MIN ? 0 : cx - (cx - o.x) * (ns / s)
      const ny = ns <= MIN ? 0 : cy - (cy - o.y) * (ns / s)
      setScale(ns)
      setOffset(clampOffset(nx, ny, ns))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [containerRef, imageRef])

  // Pan drag via global mousemove/mouseup.
  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!dragRef.current) return
      const { mx, my, ox, oy } = dragRef.current
      setOffset(clampOffset(ox + e.clientX - mx, oy + e.clientY - my, scaleRef.current))
    }
    function onUp() { dragRef.current = null }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  function onMouseDown(e: React.MouseEvent) {
    if (scaleRef.current <= MIN) return
    e.preventDefault()
    dragRef.current = { mx: e.clientX, my: e.clientY, ox: offsetRef.current.x, oy: offsetRef.current.y }
  }

  function zoomIn() {
    const s = scaleRef.current, o = offsetRef.current
    const ns = Math.min(MAX, s * 1.25)
    if (ns === s) return
    setScale(ns)
    setOffset(clampOffset(o.x * (ns / s), o.y * (ns / s), ns))
  }

  function zoomOut() {
    const s = scaleRef.current, o = offsetRef.current
    const ns = Math.max(MIN, s / 1.25)
    if (ns === s) return
    if (ns <= MIN) { setScale(MIN); setOffset({ x: 0, y: 0 }); return }
    setScale(ns)
    setOffset(clampOffset(o.x * (ns / s), o.y * (ns / s), ns))
  }

  function reset() {
    setScale(MIN)
    setOffset({ x: 0, y: 0 })
  }

  return {
    scale, offsetX: offset.x, offsetY: offset.y,
    isZoomed: scale > MIN, canZoomIn: scale < MAX,
    onMouseDown, zoomIn, zoomOut, reset,
  }
}
