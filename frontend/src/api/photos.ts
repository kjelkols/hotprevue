import { apiFetch } from './client'
import type { PhotoDetail, PhotoListItem } from '../types/api'

export function listPhotos(params: {
  limit?: number
  offset?: number
  sort?: string
  hothashes?: string[]
  sessionId?: string
  eventId?: string
}): Promise<PhotoListItem[]> {
  const q = new URLSearchParams()
  if (params.limit != null) q.set('limit', String(params.limit))
  if (params.offset != null) q.set('offset', String(params.offset))
  if (params.sort) q.set('sort', params.sort)
  if (params.sessionId) q.set('session_id', params.sessionId)
  if (params.eventId) q.set('event_id', params.eventId)
  if (params.hothashes) {
    for (const h of params.hothashes) q.append('hothash', h)
  }
  return apiFetch<PhotoListItem[]>(`/photos?${q}`)
}

export function getPhoto(hothash: string): Promise<PhotoDetail> {
  return apiFetch<PhotoDetail>(`/photos/${hothash}`)
}

export function computePerceptualHashes(): Promise<{ updated: number; already_computed: number }> {
  return apiFetch('/photos/compute-perceptual-hashes', { method: 'POST' })
}
