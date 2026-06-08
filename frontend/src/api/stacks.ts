import { apiFetch } from './client'
import type { StackDetail, StackOut } from '../types/api'

export function createStack(hothashes: string[]): Promise<StackOut> {
  return apiFetch<StackOut>('/stacks', {
    method: 'POST',
    body: JSON.stringify({ hothashes }),
  })
}

export function listStacks(): Promise<StackOut[]> {
  return apiFetch<StackOut[]>('/stacks')
}

export function getStack(stackId: string): Promise<StackDetail> {
  return apiFetch<StackDetail>(`/stacks/${stackId}`)
}

export function addPhotoToStack(stackId: string, hothash: string): Promise<StackOut> {
  return apiFetch<StackOut>(`/stacks/${stackId}/photos/${hothash}`, { method: 'POST' })
}

export function addPhotosToStackBatch(stackId: string, hothashes: string[]): Promise<StackOut> {
  return apiFetch<StackOut>(`/stacks/${stackId}/photos/batch`, {
    method: 'POST',
    body: JSON.stringify({ hothashes }),
  })
}

export function removePhotoFromStack(stackId: string, hothash: string): Promise<void> {
  return apiFetch<void>(`/stacks/${stackId}/photos/${hothash}`, { method: 'DELETE' })
}

export function setStackCover(stackId: string, hothash: string): Promise<StackOut> {
  return apiFetch<StackOut>(`/stacks/${stackId}/cover/${hothash}`, { method: 'PUT' })
}

export function deleteStack(stackId: string): Promise<void> {
  return apiFetch<void>(`/stacks/${stackId}`, { method: 'DELETE' })
}

export function removePhotosFromStacks(hothashes: string[]): Promise<void> {
  return apiFetch<void>('/stacks/remove-photos', {
    method: 'POST',
    body: JSON.stringify({ hothashes }),
  })
}

export function dissolveStack(hothashes: string[]): Promise<void> {
  return apiFetch<void>('/stacks/dissolve', {
    method: 'POST',
    body: JSON.stringify({ hothashes }),
  })
}
