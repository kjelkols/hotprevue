import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getTimelineBuckets, getTimelineEvents } from '../../api/timeline'
import { listPhotos } from '../../api/photos'
import type { TimelineBucket, TimelineEventBalloon, PhotoListItem } from '../../types/api'

export const DAY_MS = 86_400_000
export const YEAR_MS = 365.25 * DAY_MS

// Thresholds: ms per pixel
export const THRESH_MONTHS = 8e7   // month buckets when timePerPx < this
export const THRESH_DAYS = 5e6     // day buckets when timePerPx < this
export const THRESH_EVENTS = 1e8   // event balloons when timePerPx < this
export const THRESH_THUMBNAILS = 6e5 // thumbnails when timePerPx < this

export type Granularity = 'year' | 'month' | 'day'

function toIso(ms: number): string {
  return new Date(ms).toISOString()
}

function granularityFor(timePerPx: number): Granularity {
  if (timePerPx < THRESH_DAYS) return 'day'
  if (timePerPx < THRESH_MONTHS) return 'month'
  return 'year'
}

export function useTimelineData(fromMs: number, toMs: number, timePerPx: number) {
  const [debounced, setDebounced] = useState({ fromMs, toMs, timePerPx })

  useEffect(() => {
    const t = setTimeout(() => setDebounced({ fromMs, toMs, timePerPx }), 180)
    return () => clearTimeout(t)
  }, [fromMs, toMs, timePerPx])

  const granularity = granularityFor(debounced.timePerPx)
  const showThumbnails = debounced.timePerPx < THRESH_THUMBNAILS
  const showEvents = debounced.timePerPx < THRESH_EVENTS

  const bucketsKey = ['timeline-buckets', granularity,
    granularity === 'year' ? '' : debounced.fromMs, granularity === 'year' ? '' : debounced.toMs]

  const { data: buckets = [] } = useQuery<TimelineBucket[]>({
    queryKey: bucketsKey,
    queryFn: () => getTimelineBuckets({
      granularity,
      ...(granularity !== 'year' ? { from_date: toIso(debounced.fromMs), to_date: toIso(debounced.toMs) } : {}),
    }),
    staleTime: 60_000,
  })

  const { data: yearBuckets = [] } = useQuery<TimelineBucket[]>({
    queryKey: ['timeline-buckets', 'year'],
    queryFn: () => getTimelineBuckets({ granularity: 'year' }),
    staleTime: 300_000,
  })

  const { data: events = [] } = useQuery<TimelineEventBalloon[]>({
    queryKey: ['timeline-events', showEvents ? 'all' : 'off'],
    queryFn: () => getTimelineEvents(),
    enabled: showEvents,
    staleTime: 60_000,
  })

  const { data: thumbnails = [] } = useQuery<PhotoListItem[]>({
    queryKey: ['timeline-thumbs', debounced.fromMs, debounced.toMs],
    queryFn: () => listPhotos({
      taken_after: toIso(debounced.fromMs),
      taken_before: toIso(debounced.toMs),
      sort: 'taken_at_asc',
      limit: 500,
    }),
    enabled: showThumbnails,
    staleTime: 30_000,
  })

  return { buckets, yearBuckets, events, thumbnails, granularity, showThumbnails, showEvents }
}
