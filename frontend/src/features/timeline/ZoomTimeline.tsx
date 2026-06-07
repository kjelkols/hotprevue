import { useEffect, useRef, useState } from 'react'
import { useTimelineData, DAY_MS, granularityFor } from './useTimelineData'
import TimelineRows from './TimelineRows'
import { RULER_W } from './TimelineRow'
import useTimelineStore from '../../stores/useTimelineStore'

const MIN_PPD = 0.05
const MAX_PPD = 500
const MONTHS = ['jan','feb','mar','apr','mai','jun','jul','aug','sep','okt','nov','des']

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)) }

function formatAnchor(ms: number, pxPerDay: number): string {
  const d = new Date(ms)
  const gran = granularityFor(pxPerDay)
  const y = d.getUTCFullYear()
  const m = MONTHS[d.getUTCMonth()]
  const day = d.getUTCDate()
  if (gran === 'day') return `${day}. ${m} ${y}`
  if (gran === 'month') return `${m} ${y}`
  return String(y)
}

export default function ZoomTimeline() {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 1200, h: 600 })

  const { pxPerDay, topMs, setPxPerDay, setTopMs } = useTimelineStore()

  // Refs for event handlers (no stale closure)
  const ppdRef = useRef(pxPerDay)
  const topRef = useRef(topMs)
  const hRef = useRef(size.h)
  useEffect(() => { ppdRef.current = pxPerDay }, [pxPerDay])
  useEffect(() => { topRef.current = topMs }, [topMs])
  useEffect(() => { hRef.current = size.h }, [size.h])

  // Auto-center runs once per session (ref resets every mount, not persisted)
  const autoCentered = useRef(false)

  const bottomMs = topMs + (size.h * DAY_MS) / pxPerDay

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(e => {
      setSize({ w: e[0].contentRect.width, h: e[0].contentRect.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      const ppd = ppdRef.current
      if (e.ctrlKey || e.metaKey) {
        const mouseY = e.clientY - el.getBoundingClientRect().top
        const timeAtMouse = topRef.current + (mouseY * DAY_MS) / ppd
        const factor = e.deltaY > 0 ? 0.82 : 1 / 0.82
        const newPpd = clamp(ppd * factor, MIN_PPD, MAX_PPD)
        const newTop = timeAtMouse - (mouseY * DAY_MS) / newPpd
        setPxPerDay(newPpd)
        setTopMs(newTop)
      } else {
        setTopMs(topRef.current + (e.deltaY * DAY_MS) / ppd)
      }
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [setPxPerDay, setTopMs])

  const data = useTimelineData(topMs, bottomMs, pxPerDay)

  // Auto-center once per session: show full data span at appropriate zoom
  useEffect(() => {
    if (autoCentered.current) return
    if (data.isLoadingYears) return
    const withData = data.yearBuckets.filter(b => b.count > 0)
    if (withData.length === 0) return
    autoCentered.current = true

    const minYear = withData[0].year
    const maxYear = withData[withData.length - 1].year
    const totalDays = (maxYear + 1 - minYear) * 365.25
    const margin = 60 * DAY_MS
    const newPpd = clamp((hRef.current - 20) / (totalDays + 120), MIN_PPD, MAX_PPD)
    setTopMs(Date.UTC(minYear, 0, 1) - margin)
    setPxPerDay(newPpd)
  }, [data.yearBuckets, data.isLoadingYears])

  function zoom(factor: number) {
    const ppd = ppdRef.current
    const newPpd = clamp(ppd * factor, MIN_PPD, MAX_PPD)
    const mid = topRef.current + (hRef.current / 2) * DAY_MS / ppd
    setTopMs(mid - (hRef.current / 2) * DAY_MS / newPpd)
    setPxPerDay(newPpd)
  }

  const anchorLabel = formatAnchor(topMs, pxPerDay)

  return (
    <div
      ref={ref}
      className="relative bg-gray-950 rounded-xl border border-gray-800 overflow-hidden"
      style={{ height: 'calc(100vh - 80px)' }}
    >
      {data.isLoadingYears && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="text-gray-500 text-sm animate-pulse">Laster tidslinje…</div>
        </div>
      )}

      {/* Sticky time anchor — always shows current date at top of viewport */}
      <div
        className="absolute top-0 left-0 z-20 pointer-events-none flex items-end pb-1 px-2"
        style={{
          width: RULER_W,
          height: 28,
          background: 'linear-gradient(to bottom, rgba(3,7,18,0.95) 60%, transparent)',
        }}
      >
        <span className="text-xs font-semibold text-blue-300 leading-none truncate">
          {anchorLabel}
        </span>
      </div>

      <div className="absolute top-2 right-3 z-10 flex items-center gap-1.5">
        <span className="text-xs text-gray-700 mr-1">Ctrl+rull = zoom</span>
        <button onClick={() => zoom(1.7)} className="rounded bg-gray-800 px-2 py-0.5 text-sm text-gray-400 hover:text-white font-mono">+</button>
        <button onClick={() => zoom(1 / 1.7)} className="rounded bg-gray-800 px-2 py-0.5 text-sm text-gray-400 hover:text-white font-mono">−</button>
      </div>

      {!data.isLoadingYears && (
        <TimelineRows
          topMs={topMs}
          bottomMs={bottomMs}
          pxPerDay={pxPerDay}
          containerWidth={size.w}
          {...data}
        />
      )}
    </div>
  )
}
