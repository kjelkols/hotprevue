import { apiFetch } from './client'
import type { GlobalSettings, MachineSettings, Settings } from '../types/api'

export function getSettings(): Promise<Settings> {
  return apiFetch<Settings>('/settings')
}

export function patchGlobalSettings(data: Partial<GlobalSettings>): Promise<GlobalSettings> {
  return apiFetch<GlobalSettings>('/settings/global', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export function patchMachineSettings(data: {
  machine_name?: string
  default_photographer_id?: string | null
}): Promise<MachineSettings> {
  return apiFetch<MachineSettings>('/settings/machine', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}
