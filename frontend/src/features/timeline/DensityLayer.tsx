import type { TimelineBucket } from '../../types/api'
import type { Granularity } from './useTimelineData'
import { DAY_MS, YEAR_MS } from './useTimelineData'

const MONTH_MS = YEAR_MS / 12

interface Props {
  fromMs: number
  toMs: number
  timePerPx: number
  width: number
  height: number
  buckets: TimelineBucket[]
  granularity: Granularity
}

function bucketToMs(b: TimelineBucket): { startMs: number; endMs: number } {
  if (b.date) {
    const d = new Date(b.date + 'T00:00:00Z')
    return { startMs: d.getTime(), endMs: d.getTime() + DAY_MS }
  }
  if (b.month != null) {
    const start = Date.UTC(b.year, b.month - 1, 1)
    const end = Date.UTC(b.year, b.month, 1)
    return { startMs: start, endMs: end }
  }
  const start = Date.UTC(b.year, 0, 1)
  const end = Date.UTC(b.year + 1, 0, 1)
  return { startMs: start, endMs: end }
}

export default function DensityLayer({ fromMs, toMs, timePerPx, width, height, buckets, granularity }: Props) {
  if (buckets.length === 0) return null

  const maxCount = Math.max(...buckets.map(b => b.count))
  const logMax = Math.log1p(maxCount)

  const msToX = (ms: number) => (ms - fromMs) / timePerPx

  const bars = buckets.map(b => {
    const { startMs, endMs } = bucketToMs(b)
    const x1 = msToX(startMs)
    const x2 = msToX(endMs)
    const w = Math.max(1, x2 - x1 - 1)
    const ratio = logMax > 0 ? Math.log1p(b.count) / logMax : 0
    const barH = Math.max(2, ratio * (height - 4))
    return { x: x1, w, h: barH, ratio, count: b.count }
  }).filter(b => b.x + b.w > 0 && b.x < width)

  // Build smooth SVG waveform path through bar tops
  const pathPoints = bars.map(b => ({ x: b.x + b.w / 2, y: height - b.h }))

  let pathD = ''
  if (pathPoints.length >= 2) {
    pathD = `M ${pathPoints[0].x},${height}`
    pathD += ` L ${pathPoints[0].x},${pathPoints[0].y}`
    for (let i = 1; i < pathPoints.length; i++) {
      const prev = pathPoints[i - 1]
      const curr = pathPoints[i]
      const cx = (prev.x + curr.x) / 2
      pathD += ` C ${cx},${prev.y} ${cx},${curr.y} ${curr.x},${curr.y}`
    }
    pathD += ` L ${pathPoints[pathPoints.length - 1].x},${height} Z`
  }

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      width={width}
      height={height}
      style={{ top: 0 }}
    >
      <defs>
        <linearGradient id="density-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#1e3a5f" stopOpacity="0.3" />
        </linearGradient>
      </defs>

      {/* Filled waveform */}
      {pathD && (
        <path d={pathD} fill="url(#density-grad)" />
      )}

      {/* Individual bar tops for count labels at high zoom */}
      {bars.map((b, i) =>
        b.w > 40 ? (
          <text
            key={i}
            x={b.x + b.w / 2}
            y={height - b.h - 4}
            textAnchor="middle"
            className="fill-gray-400"
            fontSize="10"
          >
            {b.count}
          </text>
        ) : null
      )}
    </svg>
  )
}
