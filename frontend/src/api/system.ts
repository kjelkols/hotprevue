import { apiFetch } from './client'
import type { ScanResult } from '../types/api'

export function pickDirectory(): Promise<{ path: string | null }> {
  return apiFetch<{ path: string | null }>('/system/pick-directory', { method: 'POST' })
}

export function scanDirectory(path: string, recursive: boolean): Promise<ScanResult> {
  return apiFetch<ScanResult>('/system/scan-directory', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, recursive }),
  })
}
