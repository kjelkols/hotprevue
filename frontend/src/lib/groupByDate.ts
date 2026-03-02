import type { PhotoListItem } from '../types/api'

const MONTHS = [
  'januar', 'februar', 'mars', 'april', 'mai', 'juni',
  'juli', 'august', 'september', 'oktober', 'november', 'desember',
]

export interface DateGroup {
  key: string      // "2024-03-22" – brukes som React-nøkkel
  label: string    // "22. mars 2024"
  photos: PhotoListItem[]
}

/**
 * Grupperer bilder etter UTC-dato fra taken_at (nyeste gruppe først).
 * Bilder uten dato samles i en «Ukjent dato»-gruppe bakerst.
 */
export function groupByDate(photos: PhotoListItem[]): DateGroup[] {
  const map = new Map<string, DateGroup>()
  const undated: PhotoListItem[] = []

  for (const photo of photos) {
    if (!photo.taken_at) {
      undated.push(photo)
      continue
    }
    const dt = new Date(photo.taken_at)
    const y = dt.getUTCFullYear()
    const m = dt.getUTCMonth()   // 0-indexed
    const d = dt.getUTCDate()
    const key = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    if (!map.has(key)) {
      map.set(key, { key, label: `${d}. ${MONTHS[m]} ${y}`, photos: [] })
    }
    map.get(key)!.photos.push(photo)
  }

  const groups = Array.from(map.values()).sort((a, b) => b.key.localeCompare(a.key))

  if (undated.length > 0) {
    groups.push({ key: '__undated__', label: 'Ukjent dato', photos: undated })
  }

  return groups
}
