import { apiFetch } from './client'
import type { Photographer } from '../types/api'

export function listPhotographers(): Promise<Photographer[]> {
  return apiFetch<Photographer[]>('/photographers')
}

export function createPhotographer(data: {
  name: string
  website?: string | null
  bio?: string | null
  notes?: string | null
}): Promise<Photographer> {
  return apiFetch<Photographer>('/photographers', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function patchPhotographer(id: string, data: {
  name?: string
  website?: string | null
  bio?: string | null
  notes?: string | null
}): Promise<Photographer> {
  return apiFetch<Photographer>(`/photographers/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export function deletePhotographer(id: string): Promise<void> {
  return apiFetch<void>(`/photographers/${id}`, { method: 'DELETE' })
}
