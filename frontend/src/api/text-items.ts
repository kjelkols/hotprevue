import { apiFetch } from './client'
import type { TextItem } from '../types/api'

export function createTextItem(markup: string): Promise<TextItem> {
  return apiFetch<TextItem>('/text-items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ markup }),
  })
}
