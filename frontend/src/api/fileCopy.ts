import { agentFetch } from './agentClient'
import type { AgentCopyOperation, SuggestNameResult } from '../types/api'

export function suggestName(sourcePath: string): Promise<SuggestNameResult> {
  return agentFetch(`/copy/suggest-name?source=${encodeURIComponent(sourcePath)}`)
}

export function startCopy(data: {
  source_path: string
  destination_path: string
  device_label?: string
  verify?: boolean
  include_videos?: boolean
}): Promise<AgentCopyOperation> {
  return agentFetch('/copy', { method: 'POST', body: JSON.stringify(data) })
}

export function getCopyOperation(id: string): Promise<AgentCopyOperation> {
  return agentFetch(`/copy/${id}`)
}

export function cancelCopyOperation(id: string): Promise<void> {
  return agentFetch(`/copy/${id}`, { method: 'DELETE' })
}

export function eraseCopySource(id: string): Promise<{ deleted: number; errors: number }> {
  return agentFetch(`/copy/${id}/erase-source`, { method: 'POST' })
}
