import { apiFetch } from './client'
import type { EventNode } from '../types/api'

export function listEvents(): Promise<EventNode[]> {
  return apiFetch<EventNode[]>('/events')
}
