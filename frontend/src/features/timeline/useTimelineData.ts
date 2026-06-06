import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getTimelineBuckets, getTimelineEvents } from '../../api/timeline'
import { listPhotos } from '../../api/photos'
import type { TimelineBucket, TimelineEventBalloon, PhotoListItem } from '../../types/api'

export const DAY_MS = 86_400_000
export const YEAR_MS = 365.25 * DAY_MS

export type Granularity = 'year' | 'month' | 'day'

export function granularityFor(pxPerDay: number): Granularity {
  if (pxPerDay >= 8) return 'day'
  if (pxPerDay >= 0.4) return 'month'
  return 'year'
}

function iso(ms: number) { return new Date(ms).toISOString() }

export function useTimelineData(fromMs: number, toMs: number, pxPerDay: number) {
  const [d, setD] = useState({ fromMs, toMs, pxPerDay })
  useEffect(() => {
    const t = setTimeout(() => setD({ fromMs, toMs, pxPerDay }), 180)
    return () => clearTimeout(t)
  }, [fromMs, toMs, pxPerDay])

  const gran = granularityFor(d.pxPerDay)
  // Start fetching thumbnails early to support cloud→image crossfade
  const showThumbnails = d.pxPerDay >= 20

  const buf = 30 * DAY_MS
  const rangeParams = gran !== 'year'
    ? { from_date: iso(d.fromMs - buf), to_date: iso(d.toMs + buf) }
    : {}

  const { data: buckets = [] } = useQuery<TimelineBucket[]>({
    queryKey: ['tl-buckets', gran, d.fromMs, d.toMs],
    queryFn: () => getTimelineBuckets({ granularity: gran, ...rangeParams }),
    staleTime: 60_000,
  })

  const { data: yearBuckets = [], isLoading: isLoadingYears } = useQuery<TimelineBucket[]>({
    queryKey: ['tl-year-buckets'],
    queryFn: () => getTimelineBuckets({ granularity: 'year' }),
    staleTime: 300_000,
  })

  const { data: events = [] } = useQuery<TimelineEventBalloon[]>({
    queryKey: ['tl-events'],
    queryFn: () => getTimelineEvents(),
    enabled: gran !== 'day',
    staleTime: 120_000,
  })

  const { data: thumbnails = [] } = useQuery<PhotoListItem[]>({
    queryKey: ['tl-thumbs', d.fromMs, d.toMs],
    queryFn: () => listPhotos({
      taken_after: iso(d.fromMs - DAY_MS),
      taken_before: iso(d.toMs + DAY_MS),
      sort: 'taken_at_asc',
      limit: 1000,
    }),
    enabled: showThumbnails,
    staleTime: 30_000,
  })

  return { buckets, yearBuckets, isLoadingYears, events, thumbnails, granularity: gran, showThumbnails }
}
