import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import TimelineRuler from './TimelineRuler'
import DensityLayer from './DensityLayer'
import EventBalloons from './EventBalloons'
import ThumbnailLayer from './ThumbnailLayer'
import { useTimelineData, YEAR_MS, DAY_MS, THRESH_THUMBNAILS, THRESH_EVENTS } from './useTimelineData'

const MIN_TPP = 30_000           // 30 sec/px — max zoom
const MAX_TPP = YEAR_MS * 20     // 20 years/px — min zoom
const RULER_H = 32
const EVENTS_H = 28
const DENSITY_H = 240
const TOTAL_H = RULER_H + EVENTS_H + DENSITY_H

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}

export default function ZoomTimeline() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(1200)

  // Core state: ms per pixel + center timestamp
  const [timePerPx, setTimePerPx] = useState(YEAR_MS * 5 / 1200)
  const [centerMs, setCenterMs] = useState(() => Date.now() - YEAR_MS * 1.5)

  // Refs for event handlers (avoid stale closures)
  const tppRef = useRef(timePerPx)
  const centerRef = useRef(centerMs)
  const widthRef = useRef(width)
  useEffect(() => { tppRef.current = timePerPx }, [timePerPx])
  useEffect(() => { centerRef.current = centerMs }, [centerMs])
  useEffect(() => { widthRef.current = width }, [width])

  // Derived visible range
  const fromMs = centerMs - width / 2 * timePerPx
  const toMs = centerMs + width / 2 * timePerPx

  // Resize observer
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const w = entries[0].contentRect.width
      if (w > 0) setWidth(w)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Wheel zoom — anchored at mouse X
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const tpp = tppRef.current
      const w = widthRef.current
      const currentFrom = centerRef.current - w / 2 * tpp
      const mouseMs = currentFrom + mouseX * tpp
      const factor = e.deltaY > 0 ? 1.15 : 1 / 1.15
      const newTpp = clamp(tpp * factor, MIN_TPP, MAX_TPP)
      const newFrom = mouseMs - mouseX * newTpp
      const newCenter = newFrom + w / 2 * newTpp
      setTimePerPx(newTpp)
      setCenterMs(newCenter)
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [])

  // Pan (drag)
  const dragRef = useRef<{ startX: number; startCenter: number } | null>(null)

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragRef.current = { startX: e.clientX, startCenter: centerRef.current }
  }, [])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragRef.current) return
    const dx = e.clientX - dragRef.current.startX
    setCenterMs(dragRef.current.startCenter - dx * tppRef.current)
  }, [])

  const onMouseUp = useCallback(() => { dragRef.current = null }, [])

  const { buckets, yearBuckets, events, thumbnails, granularity, showThumbnails, showEvents } = useTimelineData(fromMs, toMs, timePerPx)
  const initializedRef = useRef(false)
  useEffect(() => {
    if (initializedRef.current || yearBuckets.length === 0) return
    initializedRef.current = true
    const minYear = yearBuckets[0].year
    const maxYear = yearBuckets[yearBuckets.length - 1].year
    const fromDataMs = Date.UTC(minYear, 0, 1)
    const toDataMs = Date.UTC(maxYear + 1, 0, 1)
    const rangeMs = toDataMs - fromDataMs
    const w = widthRef.current
    const newTpp = clamp(rangeMs / (w * 0.8), MIN_TPP, MAX_TPP)
    setCenterMs((fromDataMs + toDataMs) / 2)
    setTimePerPx(newTpp)
  }, [yearBuckets])

  const thumbOpacity = showThumbnails
    ? Math.min(1, (THRESH_THUMBNAILS / timePerPx - 0.5) * 2)
    : 0

  return (
    <div className="select-none bg-gray-950 rounded-xl border border-gray-800 overflow-hidden" style={{ height: TOTAL_H }}>
      {/* Zoom hint */}
      <div
        ref={containerRef}
        className="relative flex flex-col h-full cursor-grab active:cursor-grabbing"
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        <TimelineRuler fromMs={fromMs} toMs={toMs} timePerPx={timePerPx} width={width} />

        {showEvents && (
          <EventBalloons fromMs={fromMs} toMs={toMs} timePerPx={timePerPx} width={width} events={events} />
        )}
        {!showEvents && <div style={{ height: EVENTS_H }} />}

        <div className="relative flex-1">
          <DensityLayer
            fromMs={fromMs} toMs={toMs} timePerPx={timePerPx}
            width={width} height={DENSITY_H}
            buckets={buckets} granularity={granularity}
          />
          {showThumbnails && (
            <ThumbnailLayer
              fromMs={fromMs} toMs={toMs} timePerPx={timePerPx}
              width={width} height={DENSITY_H}
              photos={thumbnails}
              opacity={thumbOpacity}
            />
          )}
        </div>

        {/* Bottom hint */}
        <div className="absolute bottom-2 right-3 text-xs text-gray-700 pointer-events-none select-none">
          Rull for å zoome · dra for å panorere
        </div>
      </div>
    </div>
  )
}
