import { apiFetch } from './client'
import type { Machine } from '../types/api'

export function registerMachine(data: {
  machine_name: string
  photographer_id?: string | null
}): Promise<Machine> {
  return apiFetch<Machine>('/machines', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function getMachine(machineId: string): Promise<Machine> {
  return apiFetch<Machine>(`/machines/${machineId}`)
}
