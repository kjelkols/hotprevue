import type { TimelineEventBalloon } from '../../types/api'

interface Props {
  fromMs: number
  toMs: number
  timePerPx: number
  width: number
  events: TimelineEventBalloon[]
}

export default function EventBalloons({ fromMs, toMs, timePerPx, width, events }: Props) {
  const msToX = (ms: number) => (ms - fromMs) / timePerPx

  const visible = events.filter(e => {
    const from = new Date(e.from_date).getTime()
    const to = new Date(e.to_date).getTime()
    return to > fromMs && from < toMs
  })

  return (
    <div className="relative h-7 shrink-0">
      {visible.map(e => {
        const from = new Date(e.from_date).getTime()
        const to = new Date(e.to_date).getTime()
        const x1 = Math.max(0, msToX(from))
        const x2 = Math.min(width, msToX(to))
        const w = Math.max(60, x2 - x1)
        const opacity = Math.min(1, (timePerPx < 2e7 ? 1 : (1 - (timePerPx - 2e7) / (8e7 - 2e7))))

        return (
          <div
            key={e.id}
            className="absolute top-1 flex items-center"
            style={{ left: x1, width: w, opacity }}
            title={e.name}
          >
            <div className="rounded-full border border-gray-700 bg-gray-800/80 px-2 py-0.5 text-xs text-gray-400 truncate max-w-full">
              {e.name}
            </div>
          </div>
        )
      })}
    </div>
  )
}
