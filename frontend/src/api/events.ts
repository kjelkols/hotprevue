import { apiFetch } from './client'
import type { EventNode } from '../types/api'

export function listEvents(): Promise<EventNode[]> {
  return apiFetch<EventNode[]>('/events')
}

export function getEvent(id: string): Promise<EventNode> {
  return apiFetch<EventNode>(`/events/${id}`)
}

export function createEvent(data: {
  name: string
  description?: string | null
  date?: string | null
  location?: string | null
}): Promise<EventNode> {
  return apiFetch<EventNode>('/events', { method: 'POST', body: JSON.stringify(data) })
}

export function patchEvent(id: string, data: Partial<{
  name: string
  description: string | null
  date: string | null
  location: string | null
}>): Promise<EventNode> {
  return apiFetch<EventNode>(`/events/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
}

export function deleteEvent(id: string): Promise<void> {
  return apiFetch<void>(`/events/${id}`, { method: 'DELETE' })
}
