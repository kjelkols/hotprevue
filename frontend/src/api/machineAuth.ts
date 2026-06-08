import { apiFetch } from './client'

export interface InviteCode {
  id: string
  code: string
  access_level: string | null
  target_photographer_id: string | null
  photographer_name: string | null
  expires_at: string
  used_at: string | null
  created_at: string
}

export interface MachineOut {
  machine_id: string
  machine_name: string
  photographer_id: string | null
  last_seen_at: string | null
  created_at: string
}

export interface PhotographerWithMachines {
  id: string
  name: string
  access_level: string
  machines: MachineOut[]
}

export function createInviteCode(body: {
  photographer_name?: string
  access_level?: string
  ttl_minutes?: number
  target_photographer_id?: string
}): Promise<InviteCode> {
  return apiFetch('/admin/invite-codes', { method: 'POST', body: JSON.stringify(body) })
}

export function listInviteCodes(): Promise<InviteCode[]> {
  return apiFetch('/admin/invite-codes')
}

export function deleteInviteCode(id: string): Promise<void> {
  return apiFetch(`/admin/invite-codes/${id}`, { method: 'DELETE' })
}

export function listMachinesAdmin(): Promise<MachineOut[]> {
  return apiFetch('/admin/machines')
}

export function revokeMachineToken(machineId: string): Promise<void> {
  return apiFetch(`/admin/machines/${machineId}/token`, { method: 'DELETE' })
}

export function listPhotographersWithMachines(): Promise<PhotographerWithMachines[]> {
  return apiFetch('/admin/photographers')
}

export function setPhotographerAccessLevel(photographerId: string, accessLevel: string): Promise<void> {
  return apiFetch(`/admin/photographers/${photographerId}/access-level`, {
    method: 'PATCH',
    body: JSON.stringify({ access_level: accessLevel }),
  })
}
