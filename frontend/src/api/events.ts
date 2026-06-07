import { apiFetch } from './client'
import type { EventNode } from '../types/api'

export function listEvents(kindIds?: string[]): Promise<EventNode[]> {
  const q = new URLSearchParams()
  if (kindIds?.length) {
    for (const id of kindIds) q.append('kind_id', id)
  }
  const qs = q.toString()
  return apiFetch<EventNode[]>(qs ? `/events?${qs}` : '/events')
}

export function getEvent(id: string): Promise<EventNode> {
  return apiFetch<EventNode>(`/events/${id}`)
}

export function createEvent(data: {
  name: string
  description?: string | null
  start_date?: string | null
  end_date?: string | null
  location?: string | null
}): Promise<EventNode> {
  return apiFetch<EventNode>('/events', { method: 'POST', body: JSON.stringify(data) })
}

export function patchEvent(id: string, data: Partial<{
  name: string
  description: string | null
  start_date: string | null
  end_date: string | null
  location: string | null
}>): Promise<EventNode> {
  return apiFetch<EventNode>(`/events/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
}

export function autoDateEvent(id: string): Promise<EventNode> {
  return apiFetch<EventNode>(`/events/${id}/auto-date`, { method: 'POST' })
}

export function deleteEvent(id: string): Promise<void> {
  return apiFetch<void>(`/events/${id}`, { method: 'DELETE' })
}
