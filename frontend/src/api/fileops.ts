import { agentFetch } from './agentClient'
import type { MoveResult, MkdirResult, DeleteResult } from '../types/api'

export function moveGroup(masterPath: string, destinationDir: string): Promise<MoveResult> {
  return agentFetch('/files/move', {
    method: 'POST',
    body: JSON.stringify({ master_path: masterPath, destination_dir: destinationDir }),
  })
}

export function deleteGroup(masterPath: string): Promise<DeleteResult> {
  return agentFetch(`/files/group?path=${encodeURIComponent(masterPath)}`, { method: 'DELETE' })
}

export function makeDir(path: string): Promise<MkdirResult> {
  return agentFetch('/files/mkdir', {
    method: 'POST',
    body: JSON.stringify({ path }),
  })
}
