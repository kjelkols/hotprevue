import { apiFetch } from './client'
import type { TimelineBucket, TimelineEventBalloon } from '../types/api'

export function getTimelineBuckets(params: {
  granularity: 'year' | 'month' | 'day'
  from_date?: string
  to_date?: string
}): Promise<TimelineBucket[]> {
  const q = new URLSearchParams({ granularity: params.granularity })
  if (params.from_date) q.set('from_date', params.from_date)
  if (params.to_date) q.set('to_date', params.to_date)
  return apiFetch<TimelineBucket[]>(`/photos/timeline?${q}`)
}

export function getTimelineEvents(params?: {
  from_date?: string
  to_date?: string
}): Promise<TimelineEventBalloon[]> {
  const q = new URLSearchParams()
  if (params?.from_date) q.set('from_date', params.from_date)
  if (params?.to_date) q.set('to_date', params.to_date)
  return apiFetch<TimelineEventBalloon[]>(`/photos/timeline/events?${q}`)
}
