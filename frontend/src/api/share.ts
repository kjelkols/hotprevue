import { apiFetch } from './client'
import type { PublicShareOut } from '../types/api'

export function publishPhotoPublic(hothash: string): Promise<PublicShareOut> {
  return apiFetch<PublicShareOut>(`/share/photo/${hothash}/public`, { method: 'POST' })
}

export function revokePhotoPublic(hothash: string): Promise<void> {
  return apiFetch<void>(`/share/photo/${hothash}/public`, { method: 'DELETE' })
}
