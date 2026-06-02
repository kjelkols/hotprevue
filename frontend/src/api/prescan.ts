import { agentFetch } from './agentClient'
import type { PrescanJobStatus, PrescanFileEntry, ExifData } from '../types/api'

export function startPrescan(dir: string): Promise<PrescanJobStatus> {
  return agentFetch('/prescan/start', {
    method: 'POST',
    body: JSON.stringify({ dir }),
  })
}

export function getPrescanStatus(jobId: string): Promise<PrescanJobStatus> {
  return agentFetch(`/prescan/status/${jobId}`)
}

export function getPrescanFiles(dir: string): Promise<PrescanFileEntry[]> {
  return agentFetch(`/prescan/files?dir=${encodeURIComponent(dir)}`)
}

export function getExif(path: string): Promise<ExifData> {
  return agentFetch(`/process/exif?path=${encodeURIComponent(path)}`)
}
