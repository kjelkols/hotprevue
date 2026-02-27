import { useState, useRef, useEffect } from 'react'

const MIN = 1
const MAX = 4

export function useImageZoom(containerRef: React.RefObject<HTMLDivElement>) {
  const [scale, setScale] = useState(MIN)
  const [offset, setOffset] = useState({ x: 0, y: 0 })

  const scaleRef = useRef(scale)
  const offsetRef = useRef(offset)
  scaleRef.current = scale
  offsetRef.current = offset

  const dragRef = useRef<{ mx: number; my: number; ox: number; oy: number } | null>(null)

  // Non-passive wheel listener — zoom toward cursor on regular scroll.
  // ctrlKey is left to the browser (page zoom).
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
      const nx = ns <= MIN ? 0 : cx - (cx - o.x) * (ns / s)
      const ny = ns <= MIN ? 0 : cy - (cy - o.y) * (ns / s)
      setScale(ns)
      setOffset({ x: nx, y: ny })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [containerRef])

  // Pan drag via global mousemove/mouseup.
  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!dragRef.current) return
      const { mx, my, ox, oy } = dragRef.current
      setOffset({ x: ox + e.clientX - mx, y: oy + e.clientY - my })
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

  return {
    scale,
    offsetX: offset.x,
    offsetY: offset.y,
    isZoomed: scale > MIN,
    onMouseDown,
  }
}
