import { apiFetch } from './client'
import type { Shortcut } from '../types/api'

export function listShortcuts(): Promise<Shortcut[]> {
  return apiFetch('/shortcuts')
}

export function createShortcut(data: { name: string; path: string }): Promise<Shortcut> {
  return apiFetch('/shortcuts', { method: 'POST', body: JSON.stringify(data) })
}

export function patchShortcut(id: string, data: { name?: string; path?: string }): Promise<Shortcut> {
  return apiFetch(`/shortcuts/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
}

export function deleteShortcut(id: string): Promise<void> {
  return apiFetch(`/shortcuts/${id}`, { method: 'DELETE' })
}

export function moveShortcutUp(id: string): Promise<Shortcut[]> {
  return apiFetch(`/shortcuts/${id}/move-up`, { method: 'POST' })
}

export function moveShortcutDown(id: string): Promise<Shortcut[]> {
  return apiFetch(`/shortcuts/${id}/move-down`, { method: 'POST' })
}
