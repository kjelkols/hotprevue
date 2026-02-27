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

export function checkPaths(sessionId: string, masterPaths: string[]): Promise<CheckResponse> {
  return apiFetch<CheckResponse>(`/input-sessions/${sessionId}/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ master_paths: masterPaths })
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

export function completeSession(sessionId: string): Promise<ProcessResult> {
  return apiFetch<ProcessResult>(`/input-sessions/${sessionId}/complete`, {
    method: 'POST'
  })
}
