import { apiFetch } from './client'
import type { Collection, CollectionItem } from '../types/api'

// ─── Collection CRUD ──────────────────────────────────────────────────────────

export function listCollections(): Promise<Collection[]> {
  return apiFetch<Collection[]>('/collections')
}

export function getCollection(id: string): Promise<Collection> {
  return apiFetch<Collection>(`/collections/${id}`)
}

export function createCollection(data: { name: string; description?: string | null }): Promise<Collection> {
  return apiFetch<Collection>('/collections', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export function patchCollection(
  id: string,
  data: { name?: string; description?: string | null; cover_hothash?: string | null },
): Promise<Collection> {
  return apiFetch<Collection>(`/collections/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export function deleteCollection(id: string): Promise<void> {
  return apiFetch<void>(`/collections/${id}`, { method: 'DELETE' })
}

// ─── Items ────────────────────────────────────────────────────────────────────

export function getCollectionItems(id: string): Promise<CollectionItem[]> {
  return apiFetch<CollectionItem[]>(`/collections/${id}/items`)
}

export function reorderCollectionItems(id: string, itemIds: string[]): Promise<void> {
  return apiFetch<void>(`/collections/${id}/items`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ item_ids: itemIds }),
  })
}

export function addCollectionItemsBatch(
  collectionId: string,
  hothashes: string[],
): Promise<CollectionItem[]> {
  return apiFetch<CollectionItem[]>(`/collections/${collectionId}/items/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: hothashes.map(h => ({ hothash: h })) }),
  })
}

export function deleteCollectionItem(collectionId: string, itemId: string): Promise<void> {
  return apiFetch<void>(`/collections/${collectionId}/items/${itemId}`, { method: 'DELETE' })
}

export function deleteCollectionItemsBatch(
  collectionId: string,
  itemIds: string[],
): Promise<void> {
  return apiFetch<void>(`/collections/${collectionId}/items/batch`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ item_ids: itemIds }),
  })
}
