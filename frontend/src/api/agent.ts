import { agentFetch } from './agentClient'
import type { ScanResult } from '../types/api'

export interface ProcessResponse {
  hothash: string
  hotpreview_b64: string
  coldpreview_b64: string
  exif: Record<string, unknown>
  camera_fields: Record<string, unknown>
  taken_at: string | null
  gps_lat: number | null
  gps_lng: number | null
  width: number
  height: number
}

export function scanDirectory(path: string, recursive = true): Promise<ScanResult> {
  return agentFetch('/scan', {
    method: 'POST',
    body: JSON.stringify({ path, recursive }),
  })
}

export function processFile(master_path: string, companions: string[] = []): Promise<ProcessResponse> {
  return agentFetch('/process', {
    method: 'POST',
    body: JSON.stringify({ master: master_path, companions }),
  })
}
