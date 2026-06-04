import type { FileGroup, ScanResult } from '../../types/api'

export interface AnalyzeResult {
  scan: ScanResult
  unknownGroups: FileGroup[]
  dirPath: string
  photographerId: string
  recursive: boolean
}

export interface FolderEntry {
  relPath: string      // relativ til dirPath ('' = rotkatalog)
  folderPath: string   // absolutt sti
  folderName: string   // siste komponent
  eventName: string    // avledet navn (redigerbart i UI)
  totalCount: number
  newCount: number
}

export interface ResolvedEntry {
  folderPath: string
  eventId: string | null
}

export type FolderPattern =
  | 'strip_date_prefix'
  | 'strip_yyyymmdd_prefix'
  | 'strip_year_prefix'
  | 'strip_number_prefix'
  | 'identity'

export const FOLDER_PATTERNS: { id: FolderPattern; label: string }[] = [
  { id: 'strip_date_prefix', label: 'Fjern dato-prefiks (2024-07-15 Fest → Fest)' },
  { id: 'strip_yyyymmdd_prefix', label: 'Fjern kompakt dato-prefiks (20240715Fest → Fest)' },
  { id: 'strip_year_prefix', label: 'Fjern årstall-prefiks (2024 Fest → Fest)' },
  { id: 'strip_number_prefix', label: 'Fjern tall-prefiks (01 Fest → Fest)' },
  { id: 'identity', label: 'Bruk mappenavn direkte' },
]

export function applyPattern(folderName: string, pattern: FolderPattern): string {
  let result = folderName
  switch (pattern) {
    case 'strip_date_prefix':
      result = folderName.replace(/^\d{4}[-_.]?\d{2}[-_.]?\d{2}[_ ]+/, '')
      break
    case 'strip_yyyymmdd_prefix':
      result = folderName.replace(/^\d{8}[_ ]+/, '')
      break
    case 'strip_year_prefix':
      result = folderName.replace(/^\d{4}[_ -]+/, '')
      break
    case 'strip_number_prefix':
      result = folderName.replace(/^\d+[._ ]+/, '')
      break
  }
  return result.trim() || folderName
}

export function computeFolderEntries(
  groups: FileGroup[],
  unknownGroups: FileGroup[],
  dirPath: string,
  pattern: FolderPattern,
): FolderEntry[] {
  const unknownPaths = new Set(unknownGroups.map(g => g.master_path))

  const getRelDir = (masterPath: string): string => {
    const dir = masterPath.substring(0, masterPath.lastIndexOf('/'))
    if (!dir.startsWith(dirPath)) return ''
    return dir.slice(dirPath.length).replace(/^\//, '')
  }

  const relDirs = groups.map(g => getRelDir(g.master_path))
  const depth = findBestDepth(relDirs)

  const map = new Map<string, { total: number; newCount: number }>()
  for (const group of groups) {
    const components = getRelDir(group.master_path).split('/').filter(Boolean)
    const key = components.slice(0, depth + 1).join('/') || ''
    const entry = map.get(key) ?? { total: 0, newCount: 0 }
    entry.total++
    if (unknownPaths.has(group.master_path)) entry.newCount++
    map.set(key, entry)
  }

  return Array.from(map.entries())
    .map(([relPath, counts]) => {
      const folderName = relPath
        ? relPath.split('/').pop()!
        : dirPath.split('/').pop() ?? dirPath
      return {
        relPath,
        folderPath: relPath ? `${dirPath}/${relPath}` : dirPath,
        folderName,
        eventName: applyPattern(folderName, pattern),
        totalCount: counts.total,
        newCount: counts.newCount,
      }
    })
    .sort((a, b) => a.relPath.localeCompare(b.relPath))
}

function findBestDepth(relDirs: string[]): number {
  const components = relDirs.map(d => d.split('/').filter(Boolean))
  const maxDepth = Math.max(0, ...components.map(c => c.length))
  if (maxDepth === 0) return 0

  let bestDepth = 0
  let bestCount = 0
  for (let d = 0; d < maxDepth; d++) {
    const count = new Set(components.map(c => c.slice(0, d + 1).join('/'))).size
    if (count > bestCount) { bestCount = count; bestDepth = d }
  }
  return bestDepth
}

export function deriveFolderName(name: string): string {
  return name
    .toLowerCase()
    .replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/å/g, 'aa')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
