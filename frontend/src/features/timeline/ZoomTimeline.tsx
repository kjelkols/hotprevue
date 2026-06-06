import { useEffect, useRef, useState } from 'react'
import { useTimelineData, DAY_MS } from './useTimelineData'
import TimelineRows from './TimelineRows'
import useTimelineStore from '../../stores/useTimelineStore'

const MIN_PPD = 0.05
const MAX_PPD = 500

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)) }

export default function ZoomTimeline() {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 1200, h: 600 })

  const { pxPerDay, topMs, initialized, setPxPerDay, setTopMs, setInitialized } = useTimelineStore()

  // Refs for event handlers (no stale closure)
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

  // Auto-center on most recent data — only on very first visit (not if state was restored)
  useEffect(() => {
    if (initialized || data.yearBuckets.length === 0) return
    setInitialized()
    const withData = data.yearBuckets.filter(b => b.count > 0)
    if (withData.length === 0) return
    const maxYear = withData[withData.length - 1].year
    setTopMs(Date.UTC(maxYear - 2, 0, 1))
    setPxPerDay(clamp(hRef.current / (3 * 365), MIN_PPD, MAX_PPD))
  }, [data.yearBuckets, initialized])

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
      style={{ height: 'calc(100vh - 80px)' }}
    >
      <div className="absolute top-2 right-3 z-10 flex items-center gap-1.5">
        <span className="text-xs text-gray-700 mr-1">Ctrl+rull = zoom</span>
        <button onClick={() => zoom(1.7)} className="rounded bg-gray-800 px-2 py-0.5 text-sm text-gray-400 hover:text-white font-mono">+</button>
        <button onClick={() => zoom(1 / 1.7)} className="rounded bg-gray-800 px-2 py-0.5 text-sm text-gray-400 hover:text-white font-mono">−</button>
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
