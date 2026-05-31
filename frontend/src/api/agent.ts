import { agentFetch } from './agentClient'

export interface FileGroupOut {
  master: string
  companions: string[]
  has_raw: boolean
  has_jpeg: boolean
}

export interface ScanResponse {
  groups: FileGroupOut[]
  total_files: number
}

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

export function scanDirectory(path: string, recursive = true): Promise<ScanResponse> {
  return agentFetch('/scan', {
    method: 'POST',
    body: JSON.stringify({ path, recursive }),
  })
}

export function processFile(master: string, companions: string[] = []): Promise<ProcessResponse> {
  return agentFetch('/process', {
    method: 'POST',
    body: JSON.stringify({ master, companions }),
  })
}
