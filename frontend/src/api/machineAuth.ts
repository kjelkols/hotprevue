import { apiFetch } from './client'

export interface InviteCode {
  id: string
  code: string
  role: string
  photographer_name: string | null
  expires_at: string
  used_at: string | null
  created_at: string
}

export interface MachineWithRole {
  machine_id: string
  machine_name: string
  role: string
  photographer_id: string | null
  last_seen_at: string | null
  created_at: string
}

export function createInviteCode(body: {
  photographer_name?: string
  ttl_minutes?: number
  role?: string
}): Promise<InviteCode> {
  return apiFetch('/admin/invite-codes', { method: 'POST', body: JSON.stringify(body) })
}

export function listInviteCodes(): Promise<InviteCode[]> {
  return apiFetch('/admin/invite-codes')
}

export function deleteInviteCode(id: string): Promise<void> {
  return apiFetch(`/admin/invite-codes/${id}`, { method: 'DELETE' })
}

export function listMachinesAdmin(): Promise<MachineWithRole[]> {
  return apiFetch('/admin/machines')
}

export function revokeMachineToken(machineId: string): Promise<void> {
  return apiFetch(`/admin/machines/${machineId}/token`, { method: 'DELETE' })
}
