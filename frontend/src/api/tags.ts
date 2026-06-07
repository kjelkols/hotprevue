import { apiFetch } from './client'
import type { TagOut, TagSimilar, TagMergeResult } from '../types/api'

export function listTags(): Promise<TagOut[]> {
  return apiFetch<TagOut[]>('/tags')
}

export function createTag(name: string): Promise<TagOut> {
  return apiFetch<TagOut>('/tags', { method: 'POST', body: JSON.stringify({ name }) })
}

export function renameTag(id: string, name: string): Promise<TagOut> {
  return apiFetch<TagOut>(`/tags/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) })
}

export function deleteTag(id: string): Promise<void> {
  return apiFetch<void>(`/tags/${id}`, { method: 'DELETE' })
}

export function mergeTags(sourceId: string, targetId: string): Promise<TagMergeResult> {
  return apiFetch<TagMergeResult>(`/tags/${sourceId}/merge-into/${targetId}`, { method: 'POST' })
}

export function similarTags(name: string): Promise<TagSimilar[]> {
  return apiFetch<TagSimilar[]>(`/tags/similar?name=${encodeURIComponent(name)}`)
}

export function tagsForPhotos(hothashes: string[]): Promise<Record<string, string[]>> {
  return apiFetch<Record<string, string[]>>('/tags/for-photos', {
    method: 'POST',
    body: JSON.stringify({ hothashes }),
  })
}

export function addTagToPhotos(tagId: string, hothashes: string[]): Promise<{ added: number }> {
  return apiFetch<{ added: number }>(`/tags/${tagId}/add-to-photos`, {
    method: 'POST',
    body: JSON.stringify({ hothashes }),
  })
}

export function removeTagFromPhotos(tagId: string, hothashes: string[]): Promise<{ removed: number }> {
  return apiFetch<{ removed: number }>(`/tags/${tagId}/remove-from-photos`, {
    method: 'POST',
    body: JSON.stringify({ hothashes }),
  })
}
