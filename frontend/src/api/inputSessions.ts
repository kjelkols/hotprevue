import { apiFetch } from './client'
import type {
  CheckResponse,
  CompanionFile,
  GroupResult,
  InputSession,
  InputSessionCreate,
  ProcessResult
} from '../types/api'

export function listSessions(): Promise<InputSession[]> {
  return apiFetch<InputSession[]>('/input-sessions')
}

export function createSession(data: InputSessionCreate): Promise<InputSession> {
  return apiFetch<InputSession>('/input-sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
}

export function checkHothashes(sessionId: string, hothashes: string[]): Promise<CheckResponse> {
  return apiFetch<CheckResponse>(`/input-sessions/${sessionId}/check-hothashes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hothashes })
  })
}

export function uploadGroup(
  sessionId: string,
  masterPath: string,
  masterType: string,
  fileBytes: Uint8Array,
  companions: CompanionFile[]
): Promise<GroupResult> {
  const form = new FormData()
  const ext = masterPath.split('.').pop() ?? 'jpg'
  form.append('master_file', new Blob([fileBytes.buffer as ArrayBuffer]), `file.${ext}`)
  form.append(
    'metadata',
    JSON.stringify({ master_path: masterPath, master_type: masterType, companions })
  )
  return apiFetch<GroupResult>(`/input-sessions/${sessionId}/groups`, {
    method: 'POST',
    body: form
  })
}

export function uploadGroupByPath(
  sessionId: string,
  masterPath: string,
  masterType: string,
  companions: CompanionFile[]
): Promise<GroupResult> {
  return apiFetch<GroupResult>(`/input-sessions/${sessionId}/groups-by-path`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ master_path: masterPath, master_type: masterType, companions }),
  })
}

export interface GroupPayload {
  hothash: string
  hotpreview_b64: string
  coldpreview_b64: string
  master_path: string
  master_type: string
  master_exif?: Record<string, unknown>
  width?: number
  height?: number
  taken_at?: string | null
  location_lat?: number | null
  location_lng?: number | null
  camera_make?: string | null
  camera_model?: string | null
  lens_model?: string | null
  iso?: number | null
  shutter_speed?: string | null
  aperture?: number | null
  focal_length?: number | null
  companions?: { path: string; type: string }[]
}

export function registerGroup(sessionId: string, payload: GroupPayload): Promise<GroupResult> {
  return apiFetch<GroupResult>(`/input-sessions/${sessionId}/groups`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function completeSession(sessionId: string): Promise<ProcessResult> {
  return apiFetch<ProcessResult>(`/input-sessions/${sessionId}/complete`, {
    method: 'POST'
  })
}

export function deleteSession(sessionId: string): Promise<void> {
  return apiFetch<void>(`/input-sessions/${sessionId}`, { method: 'DELETE' })
}
