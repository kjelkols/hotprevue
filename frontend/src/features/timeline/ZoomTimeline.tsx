import { useEffect, useRef, useState } from 'react'
import { useTimelineData, DAY_MS, YEAR_MS } from './useTimelineData'
import TimelineRows from './TimelineRows'

const MIN_PPD = 0.05
const MAX_PPD = 500

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)) }

export default function ZoomTimeline() {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 1200, h: 600 })
  const [pxPerDay, setPxPerDay] = useState(30)
  const [topMs, setTopMs] = useState(() => Date.now() - 90 * DAY_MS)

  const ppdRef = useRef(pxPerDay)
  const topRef = useRef(topMs)
  const hRef = useRef(size.h)
  useEffect(() => { ppdRef.current = pxPerDay }, [pxPerDay])
  useEffect(() => { topRef.current = topMs }, [topMs])
  useEffect(() => { hRef.current = size.h }, [size.h])

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
        // Zoom anchored at mouse Y
        const mouseY = e.clientY - el.getBoundingClientRect().top
        const timeAtMouse = topRef.current + (mouseY * DAY_MS) / ppd
        const factor = e.deltaY > 0 ? 0.82 : 1 / 0.82
        const newPpd = clamp(ppd * factor, MIN_PPD, MAX_PPD)
        setTopMs(timeAtMouse - (mouseY * DAY_MS) / newPpd)
        setPxPerDay(newPpd)
      } else {
        // Pan: scroll in time
        setTopMs(t => t + (e.deltaY * DAY_MS) / ppd)
      }
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [])

  const data = useTimelineData(topMs, bottomMs, pxPerDay)

  // Auto-center on most recent data on first load
  const initialized = useRef(false)
  useEffect(() => {
    if (initialized.current || data.yearBuckets.length === 0) return
    initialized.current = true
    const maxYear = data.yearBuckets[data.yearBuckets.length - 1].year
    const recentMs = Date.UTC(maxYear + 1, 0, 1)
    setTopMs(recentMs - 120 * DAY_MS)
    setPxPerDay(clamp(hRef.current / 100, MIN_PPD, MAX_PPD))
  }, [data.yearBuckets])

  function zoom(factor: number) {
    const ppd = ppdRef.current
    const newPpd = clamp(ppd * factor, MIN_PPD, MAX_PPD)
    const mid = topRef.current + (hRef.current / 2) * DAY_MS / ppd
    setTopMs(mid - (hRef.current / 2) * DAY_MS / newPpd)
    setPxPerDay(newPpd)
  }

  return (
    <div
      ref={ref}
      className="relative bg-gray-950 rounded-xl border border-gray-800 overflow-hidden"
      style={{ height: 'calc(100vh - 120px)' }}
    >
      <div className="absolute top-2 right-3 z-10 flex items-center gap-1.5">
        <span className="text-xs text-gray-700 mr-1">Ctrl+rull = zoom</span>
        <button onClick={() => zoom(1.6)} className="rounded bg-gray-800 px-2 py-0.5 text-sm text-gray-400 hover:text-white font-mono leading-none">+</button>
        <button onClick={() => zoom(1 / 1.6)} className="rounded bg-gray-800 px-2 py-0.5 text-sm text-gray-400 hover:text-white font-mono leading-none">−</button>
      </div>
      <TimelineRows
        topMs={topMs}
        bottomMs={bottomMs}
        pxPerDay={pxPerDay}
        containerWidth={size.w}
        {...data}
      />
    </div>
  )
}
