import { apiFetch } from './client'
import type {
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

export interface GroupPayload {
  hothash: string
  hotpreview_b64: string
  coldpreview_b64: string
  master_path: string
  master_type: string
  event_id?: string | null
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
  sharpness_score?: number | null
  exposure_mean?: number | null
  exposure_clipping?: number | null
  noise_score?: number | null
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
