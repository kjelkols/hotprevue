import { apiFetch } from './client'
import type { AiSearchResult } from '../types/api'

export function aiSearch(q: string, limit = 20): Promise<AiSearchResult[]> {
  const params = new URLSearchParams({ q, limit: String(limit) })
  return apiFetch<AiSearchResult[]>(`/ai/search?${params}`)
}
