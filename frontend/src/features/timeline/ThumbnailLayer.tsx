import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { PhotoListItem } from '../../types/api'
import { DAY_MS } from './useTimelineData'

const THUMB_MAX = 80
const ROW_H = 84
const MAX_ROWS = 3

interface Props {
  fromMs: number
  toMs: number
  timePerPx: number
  width: number
  height: number
  photos: PhotoListItem[]
  opacity: number
}

export default function ThumbnailLayer({ fromMs, toMs, timePerPx, width, height, photos, opacity }: Props) {
  const navigate = useNavigate()
  const msToX = (ms: number) => (ms - fromMs) / timePerPx

  const thumbSize = Math.min(THUMB_MAX, Math.max(24, DAY_MS / timePerPx - 4))

  // Group photos by day
  const byDay = useMemo(() => {
    const map = new Map<string, PhotoListItem[]>()
    for (const p of photos) {
      if (!p.taken_at) continue
      const d = p.taken_at.slice(0, 10)
      const arr = map.get(d) ?? []
      arr.push(p)
      map.set(d, arr)
    }
    return map
  }, [photos])

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ opacity }}>
      {Array.from(byDay.entries()).map(([day, dayPhotos]) => {
        const dayMs = new Date(day + 'T00:00:00Z').getTime()
        const cx = msToX(dayMs + DAY_MS / 2)
        if (cx + thumbSize < 0 || cx - thumbSize > width) return null

        const visible = dayPhotos.slice(0, MAX_ROWS)
        const extra = dayPhotos.length - visible.length

        return (
          <div
            key={day}
            className="absolute flex flex-col gap-0.5 pointer-events-auto"
            style={{
              left: cx - thumbSize / 2,
              top: (height - visible.length * (thumbSize + 2)) / 2,
            }}
          >
            {visible.map(p => (
              <img
                key={p.hothash}
                src={`data:image/jpeg;base64,${p.hotpreview_b64}`}
                alt=""
                className="rounded cursor-pointer hover:ring-1 hover:ring-blue-400 object-cover"
                style={{ width: thumbSize, height: thumbSize }}
                onClick={() => navigate(`/photos/${p.hothash}`)}
                title={p.taken_at ?? ''}
              />
            ))}
            {extra > 0 && (
              <div
                className="flex items-center justify-center rounded bg-gray-800 text-xs text-gray-400 cursor-pointer hover:bg-gray-700"
                style={{ width: thumbSize, height: Math.min(thumbSize, 20) }}
              >
                +{extra}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
