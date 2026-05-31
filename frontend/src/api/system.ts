import { apiFetch } from './client'
import { agentFetch } from './agentClient'
import type { BrowseResult, BrowseDir, ScanResult } from '../types/api'

export function browseDirectory(path: string): Promise<BrowseResult> {
  const params = new URLSearchParams({ path })
  return agentFetch<BrowseResult>(`/browse?${params}`)
}

export function listVolumes(): Promise<BrowseDir[]> {
  return agentFetch<BrowseDir[]>('/browse/volumes')
}

export function scanDirectory(path: string, recursive: boolean): Promise<ScanResult> {
  return apiFetch<ScanResult>('/system/scan-directory', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, recursive }),
  })
}
