import { apiFetch } from './client'
import type { PhotoDetail, PhotoListItem, CheckResponse, SharedPhotoOut } from '../types/api'

export function listPhotos(params: {
  limit?: number
  offset?: number
  sort?: string
  hothashes?: string[]
  sessionId?: string
  eventId?: string
  kindIds?: string[]
  taken_after?: string
  taken_before?: string
  stacksCollapsed?: boolean
}): Promise<PhotoListItem[]> {
  const q = new URLSearchParams()
  if (params.limit != null) q.set('limit', String(params.limit))
  if (params.offset != null) q.set('offset', String(params.offset))
  if (params.sort) q.set('sort', params.sort)
  if (params.sessionId) q.set('session_id', params.sessionId)
  if (params.eventId) q.set('event_id', params.eventId)
  if (params.kindIds) {
    for (const id of params.kindIds) q.append('kind_id', id)
  }
  if (params.taken_after) q.set('taken_after', params.taken_after)
  if (params.taken_before) q.set('taken_before', params.taken_before)
  if (params.hothashes) {
    for (const h of params.hothashes) q.append('hothash', h)
  }
  if (params.stacksCollapsed) q.set('stacks_collapsed', 'true')
  return apiFetch<PhotoListItem[]>(`/photos?${q}`)
}

export function getPhoto(hothash: string): Promise<PhotoDetail> {
  return apiFetch<PhotoDetail>(`/photos/${hothash}`)
}

export function computePerceptualHashes(): Promise<{ updated: number; already_computed: number }> {
  return apiFetch('/photos/compute-perceptual-hashes', { method: 'POST' })
}

export function patchPhoto(hothash: string, data: {
  location_lat?: number | null
  location_lng?: number | null
  location_source?: number | null
  location_accuracy?: string | null
  is_shared?: boolean | null
  share_caption?: string | null
  share_downloads?: boolean | null
}): Promise<PhotoDetail> {
  return apiFetch<PhotoDetail>(`/photos/${hothash}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export function getSharedPhoto(hothash: string): Promise<SharedPhotoOut> {
  return apiFetch<SharedPhotoOut>(`/share/photo/${hothash}`)
}

export function assignEvent(hothashes: string[], eventId: string | null): Promise<{ updated: number }> {
  return apiFetch<{ updated: number }>('/photos/batch/event', {
    method: 'POST',
    body: JSON.stringify({ hothashes, event_id: eventId }),
  })
}

export function batchRating(hothashes: string[], rating: number | null): Promise<{ updated: number }> {
  return apiFetch<{ updated: number }>('/photos/batch/rating', {
    method: 'POST',
    body: JSON.stringify({ hothashes, rating }),
  })
}

export function batchPhotographer(hothashes: string[], photographerId: string): Promise<{ updated: number }> {
  return apiFetch<{ updated: number }>('/photos/batch/photographer', {
    method: 'POST',
    body: JSON.stringify({ hothashes, photographer_id: photographerId }),
  })
}

export function batchDelete(hothashes: string[]): Promise<{ updated: number }> {
  return apiFetch<{ updated: number }>('/photos/batch/delete', {
    method: 'POST',
    body: JSON.stringify({ hothashes }),
  })
}

export interface CorrectionPatch {
  rotation?: number | null
  flip_horizontal?: boolean
  horizon_angle?: number | null
  exposure_ev?: number | null
  crop_left?: number | null
  crop_top?: number | null
  crop_right?: number | null
  crop_bottom?: number | null
}

export function updateCorrection(hothash: string, data: CorrectionPatch): Promise<PhotoDetail> {
  return apiFetch<PhotoDetail>(`/photos/${hothash}/correction`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export function deleteCorrection(hothash: string): Promise<void> {
  return apiFetch<void>(`/photos/${hothash}/correction`, { method: 'DELETE' })
}

export function checkHothashesGlobal(hothashes: string[]): Promise<CheckResponse> {
  return apiFetch<CheckResponse>('/photos/check-hothashes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hothashes }),
  })
}
