import { DAY_MS, YEAR_MS, THRESH_MONTHS, THRESH_DAYS } from './useTimelineData'

const MONTH_NAMES = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des']

interface Props {
  fromMs: number
  toMs: number
  timePerPx: number
  width: number
}

interface Tick {
  x: number
  label: string
  major: boolean
}

function msToX(ms: number, fromMs: number, timePerPx: number) {
  return (ms - fromMs) / timePerPx
}

function buildTicks(fromMs: number, toMs: number, timePerPx: number): Tick[] {
  const ticks: Tick[] = []
  const showMonths = timePerPx < THRESH_MONTHS
  const showDays = timePerPx < THRESH_DAYS

  const from = new Date(fromMs)
  const to = new Date(toMs)

  if (showDays) {
    // day ticks
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate())
    while (d.getTime() < to.getTime()) {
      const ms = d.getTime()
      const x = msToX(ms, fromMs, timePerPx)
      const isFirst = d.getDate() === 1
      const label = isFirst
        ? `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`
        : String(d.getDate())
      ticks.push({ x, label: isFirst ? label : label, major: isFirst })
      d.setDate(d.getDate() + 1)
    }
  } else if (showMonths) {
    // month ticks
    const d = new Date(from.getFullYear(), from.getMonth(), 1)
    while (d.getTime() < to.getTime()) {
      const ms = d.getTime()
      const x = msToX(ms, fromMs, timePerPx)
      const isJan = d.getMonth() === 0
      ticks.push({ x, label: isJan ? String(d.getFullYear()) : MONTH_NAMES[d.getMonth()], major: isJan })
      d.setMonth(d.getMonth() + 1)
    }
  } else {
    // year ticks
    const startYear = from.getFullYear()
    const endYear = to.getFullYear() + 1
    for (let y = startYear; y <= endYear; y++) {
      const ms = new Date(y, 0, 1).getTime()
      if (ms > toMs) break
      const x = msToX(ms, fromMs, timePerPx)
      ticks.push({ x, label: String(y), major: true })
    }
  }

  // Filter ticks too close together (< 30px)
  const result: Tick[] = []
  let lastX = -100
  for (const t of ticks) {
    if (t.x < -60 || t.x > 9999) continue
    if (t.x - lastX >= 30 || t.major) {
      result.push(t)
      lastX = t.x
    }
  }
  return result
}

export default function TimelineRuler({ fromMs, toMs, timePerPx, width }: Props) {
  const ticks = buildTicks(fromMs, toMs, timePerPx)

  return (
    <div className="relative h-8 border-b border-gray-800 bg-gray-950 shrink-0">
      {ticks.map((t, i) => (
        <div
          key={i}
          className="absolute top-0 flex flex-col items-start"
          style={{ left: t.x, transform: 'translateX(-50%)' }}
        >
          <div className={`h-2 w-px mt-1 ${t.major ? 'bg-gray-500' : 'bg-gray-700'}`} />
          <span className={`text-xs mt-0.5 whitespace-nowrap ${t.major ? 'text-gray-300 font-medium' : 'text-gray-600'}`}>
            {t.label}
          </span>
        </div>
      ))}
      {/* Today marker */}
      {(() => {
        const x = msToX(Date.now(), fromMs, timePerPx)
        if (x < 0 || x > width) return null
        return <div className="absolute top-0 bottom-0 w-px bg-blue-500/40" style={{ left: x }} />
      })()}
    </div>
  )
}
