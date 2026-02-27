import { apiFetch } from './client'
import type { PhotoDetail, PhotoListItem } from '../types/api'

export function listPhotos(params: {
  limit?: number
  offset?: number
  sort?: string
}): Promise<PhotoListItem[]> {
  const q = new URLSearchParams()
  if (params.limit != null) q.set('limit', String(params.limit))
  if (params.offset != null) q.set('offset', String(params.offset))
  if (params.sort) q.set('sort', params.sort)
  return apiFetch<PhotoListItem[]>(`/photos?${q}`)
}

export function getPhoto(hothash: string): Promise<PhotoDetail> {
  return apiFetch<PhotoDetail>(`/photos/${hothash}`)
}
