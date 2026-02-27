import { apiFetch } from './client'
import type { Photographer } from '../types/api'

export function listPhotographers(): Promise<Photographer[]> {
  return apiFetch<Photographer[]>('/photographers')
}

export function createPhotographer(name: string): Promise<Photographer> {
  return apiFetch<Photographer>('/photographers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  })
}
