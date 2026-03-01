import { apiFetch } from './client'
import type { FileCopyOperation, FileCopySkip, SuggestNameResult } from '../types/api'

export function suggestName(sourcePath: string): Promise<SuggestNameResult> {
  return apiFetch(`/file-copy-operations/suggest-name?source_path=${encodeURIComponent(sourcePath)}`)
}

export function startCopy(data: {
  source_path: string
  destination_path: string
  device_label?: string
  notes?: string
}): Promise<FileCopyOperation> {
  return apiFetch('/file-copy-operations', { method: 'POST', body: JSON.stringify(data) })
}

export function getCopyOperation(id: string): Promise<FileCopyOperation> {
  return apiFetch(`/file-copy-operations/${id}`)
}

export function getCopySkips(id: string): Promise<FileCopySkip[]> {
  return apiFetch(`/file-copy-operations/${id}/skips`)
}

export function cancelCopyOperation(id: string): Promise<void> {
  return apiFetch(`/file-copy-operations/${id}`, { method: 'DELETE' })
}

export function listCopyOperations(): Promise<FileCopyOperation[]> {
  return apiFetch('/file-copy-operations')
}

export function linkCopyToSession(operationId: string, sessionId: string): Promise<FileCopyOperation> {
  return apiFetch(`/file-copy-operations/${operationId}/link-session?session_id=${sessionId}`, { method: 'PATCH' })
}
