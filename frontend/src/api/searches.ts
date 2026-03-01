import { apiFetch } from './client'
import type { SavedSearch, SearchCriterion, PhotoListItem, TimelineYear } from '../types/api'

export interface ExecuteSearchRequest {
  logic: 'AND' | 'OR'
  criteria: SearchCriterion[]
  sort?: string
  limit: number
  offset: number
  /** Always ANDed with search expression. See docs/decisions/006-timeline.md */
  date_filter?: string  // ISO date "YYYY-MM-DD"
}

export function listSearches(): Promise<SavedSearch[]> {
  return apiFetch<SavedSearch[]>('/searches')
}

export function getSearch(id: string): Promise<SavedSearch> {
  return apiFetch<SavedSearch>(`/searches/${id}`)
}

export function createSearch(data: {
  name: string
  description?: string | null
  logic?: string
  criteria?: SearchCriterion[]
}): Promise<SavedSearch> {
  return apiFetch<SavedSearch>('/searches', { method: 'POST', body: JSON.stringify(data) })
}

export function patchSearch(id: string, data: {
  name?: string
  description?: string | null
  logic?: string
  criteria?: SearchCriterion[]
}): Promise<SavedSearch> {
  return apiFetch<SavedSearch>(`/searches/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
}

export function deleteSearch(id: string): Promise<void> {
  return apiFetch<void>(`/searches/${id}`, { method: 'DELETE' })
}

export function executeSearch(req: ExecuteSearchRequest): Promise<PhotoListItem[]> {
  return apiFetch<PhotoListItem[]>('/searches/execute', {
    method: 'POST',
    body: JSON.stringify(req),
  })
}

export function fetchSearchTimeline(req: {
  logic: 'AND' | 'OR'
  criteria: SearchCriterion[]
}): Promise<TimelineYear[]> {
  return apiFetch<TimelineYear[]>('/searches/timeline', {
    method: 'POST',
    body: JSON.stringify(req),
  })
}
