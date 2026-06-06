import { useMemo } from 'react'
import type { TimelineBucket, PhotoListItem } from '../../types/api'
import type { Granularity } from './useTimelineData'
import TimelineRow from './TimelineRow'
import { buildRows } from './buildRows'

interface Props {
  topMs: number
  bottomMs: number
  pxPerDay: number
  containerWidth: number
  granularity: Granularity
  buckets: TimelineBucket[]
  thumbnails: PhotoListItem[]
  showThumbnails: boolean
}

function makeBucketMap(buckets: TimelineBucket[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const b of buckets) {
    const key = b.date ?? (b.month != null ? `${b.year}-${b.month}` : String(b.year))
    m.set(key, b.count)
  }
  return m
}

function makePhotosByDay(thumbnails: PhotoListItem[]): Map<string, PhotoListItem[]> {
  const m = new Map<string, PhotoListItem[]>()
  for (const p of thumbnails) {
    if (!p.taken_at) continue
    const day = p.taken_at.slice(0, 10)
    const arr = m.get(day) ?? []
    arr.push(p)
    m.set(day, arr)
  }
  return m
}

export default function TimelineRows({ topMs, bottomMs, pxPerDay, containerWidth, granularity, buckets, thumbnails, showThumbnails }: Props) {
  const bucketMap = useMemo(() => makeBucketMap(buckets), [buckets])
  const photosByDay = useMemo(() => makePhotosByDay(thumbnails), [thumbnails])
  const maxCount = useMemo(() => Math.max(1, ...buckets.map(b => b.count)), [buckets])

  const rows = useMemo(
    () => buildRows(topMs, bottomMs, pxPerDay, granularity, bucketMap, photosByDay, showThumbnails),
    [topMs, bottomMs, pxPerDay, granularity, bucketMap, photosByDay, showThumbnails]
  )

  return (
    <div className="relative w-full h-full overflow-hidden">
      {rows.map(row => (
        <TimelineRow
          key={row.key}
          row={row}
          maxCount={maxCount}
          containerWidth={containerWidth}
          showThumbnails={showThumbnails}
        />
      ))}
    </div>
  )
}
