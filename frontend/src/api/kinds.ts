import { apiFetch } from './client'
import type { KindOut } from '../types/api'

export function listKinds(): Promise<KindOut[]> {
  return apiFetch<KindOut[]>('/kinds')
}

export function createKind(data: {
  name: string
  description?: string | null
  color?: string | null
  hidden_by_default?: boolean
  sort_order?: number
}): Promise<KindOut> {
  return apiFetch<KindOut>('/kinds', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function patchKind(id: string, data: {
  name?: string
  description?: string | null
  color?: string | null
  hidden_by_default?: boolean
  sort_order?: number
}): Promise<KindOut> {
  return apiFetch<KindOut>(`/kinds/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export function deleteKind(id: string): Promise<void> {
  return apiFetch<void>(`/kinds/${id}`, { method: 'DELETE' })
}
