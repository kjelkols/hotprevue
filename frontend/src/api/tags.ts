import { apiFetch } from './client'
import type { Tag } from '../types/api'

export function listTags(): Promise<Tag[]> {
  return apiFetch<Tag[]>('/tags')
}
