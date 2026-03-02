import { apiFetch } from './client'
import type { HomeStats } from '../types/api'

export function getHomeStats(): Promise<HomeStats> {
  return apiFetch<HomeStats>('/stats')
}
