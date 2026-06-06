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

export interface FolderMapping {
  folderPath: string
  eventName: string
  existingEventId: string | null
}

export interface NamingOptions {
  stripDatePrefix: boolean      // YYYY-MM-DD_ / YYYY_MM_DD_
  stripCompactDate: boolean     // YYYYMMDD_
  stripYearPrefix: boolean      // YYYY_
  stripNumberPrefix: boolean    // 01_
  underscoresToSpaces: boolean  // _ → mellomrom
}

export const DEFAULT_NAMING_OPTIONS: NamingOptions = {
  stripDatePrefix: false,
  stripCompactDate: false,
  stripYearPrefix: false,
  stripNumberPrefix: false,
  underscoresToSpaces: false,
}

export const NAMING_OPTION_LABELS: { key: keyof NamingOptions; label: string }[] = [
  { key: 'stripDatePrefix', label: 'Fjern dato-prefiks (2024-07-15_fest → fest)' },
  { key: 'stripCompactDate', label: 'Fjern kompakt dato (20240715_fest → fest)' },
  { key: 'stripYearPrefix', label: 'Fjern årstall (2024_fest → fest)' },
  { key: 'stripNumberPrefix', label: 'Fjern tall-prefiks (01_fest → fest)' },
  { key: 'underscoresToSpaces', label: 'Understrek → mellomrom' },
]

export function applyOptions(folderName: string, options: NamingOptions): string {
  let result = folderName
  if (options.stripDatePrefix) result = result.replace(/^\d{4}[-_.]?\d{2}[-_.]?\d{2}[_ ]+/, '')
  if (options.stripCompactDate) result = result.replace(/^\d{8}[_ ]+/, '')
  if (options.stripYearPrefix) result = result.replace(/^\d{4}[_ -]+/, '')
  if (options.stripNumberPrefix) result = result.replace(/^\d+[._ ]+/, '')
  if (options.underscoresToSpaces) result = result.replace(/_/g, ' ')
  return result.trim() || folderName
}

export function computeFolderEntries(
  groups: FileGroup[],
  unknownGroups: FileGroup[],
  dirPath: string,
  options: NamingOptions,
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
        eventName: applyOptions(folderName, options),
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

