import { useState, useRef, useEffect } from 'react'
import { checkHothashesGlobal } from '../../api/photos'
import { hashFile } from '../../api/agent'
import { buildTree, flatDirs, DEFAULT_NODE_STATE, type NodeState } from './treeUtils'
import TreeScanNode from './TreeScanNode'
import type { FileGroup, ScanResult } from '../../types/api'

interface Props {
  scan: ScanResult
  dirPath: string
  onDone: (unknownGroups: FileGroup[]) => void
  onBack: () => void
}

type Phase = 'preview' | 'scanning' | 'done'

export default function StepTreeScan({ scan, dirPath, onDone, onBack }: Props) {
  const [phase, setPhase] = useState<Phase>('preview')
  const [nodeStates, setNodeStates] = useState<Record<string, NodeState>>({})
  const [stats, setStats] = useState({ newCount: 0, knownCount: 0, errors: 0, scanned: 0 })
  const [result, setResult] = useState<FileGroup[]>([])
  const [scanningPath, setScanningPath] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const tree = buildTree(dirPath, scan.groups)

  useEffect(() => {
    if (!scanningPath || !containerRef.current) return
    const escaped = scanningPath.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    const el = containerRef.current.querySelector<HTMLElement>(`[data-scan-path="${escaped}"]`)
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [scanningPath])

  function setNode(path: string, state: NodeState) {
    setNodeStates(prev => ({ ...prev, [path]: state }))
  }

  async function runScan() {
    setPhase('scanning')
    const dirs = flatDirs(tree)
    const newGroups: FileGroup[] = []
    let totalNew = 0, totalKnown = 0, totalErrors = 0, totalScanned = 0

    for (const dir of dirs) {
      setNode(dir.path, { status: 'scanning', newCount: 0, knownCount: 0, errorCount: 0 })
      setScanningPath(dir.path)
      try {
        const hashes = await Promise.all(
          dir.groups.map(g => hashFile(g.master_path).then(r => ({ group: g, hothash: r.hothash })))
        )
        const check = await checkHothashesGlobal(hashes.map(h => h.hothash))
        const unknownSet = new Set(check.unknown)
        let dirNew = 0, dirKnown = 0
        for (const { group, hothash } of hashes) {
          if (unknownSet.has(hothash)) { dirNew++; newGroups.push(group) }
          else dirKnown++
        }
        totalNew += dirNew; totalKnown += dirKnown; totalScanned += dir.groups.length
        setNode(dir.path, { status: 'done', newCount: dirNew, knownCount: dirKnown, errorCount: 0 })
      } catch {
        totalErrors += dir.groups.length; totalScanned += dir.groups.length
        setNode(dir.path, { status: 'done', newCount: 0, knownCount: 0, errorCount: dir.groups.length })
      }
      setStats({ newCount: totalNew, knownCount: totalKnown, errors: totalErrors, scanned: totalScanned })
    }

    setResult(newGroups)
    setPhase('done')
  }

  const getState = (path: string): NodeState => nodeStates[path] ?? DEFAULT_NODE_STATE

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="rounded-xl border border-gray-700 bg-gray-900 overflow-hidden">
        <div className="px-4 py-2 border-b border-gray-800 flex items-center justify-between">
          <span className="text-xs text-gray-600 font-mono truncate">{dirPath}</span>
          <span className="text-xs text-gray-600 shrink-0 ml-3">{scan.groups.length} filer</span>
        </div>
        <div ref={containerRef} className="overflow-y-auto max-h-[55vh] py-1">
          <TreeScanNode node={tree} depth={0} getState={getState} />
        </div>
      </div>

      {phase !== 'preview' && (
        <div className="flex items-center gap-6 px-1 text-sm">
          <span className="text-green-400 font-medium">{stats.newCount} nye</span>
          <span className="text-gray-500">{stats.knownCount} kjente</span>
          {stats.errors > 0 && <span className="text-red-400">{stats.errors} feil</span>}
          <span className="text-gray-700 ml-auto tabular-nums">
            {stats.scanned} / {scan.groups.length} skannet
          </span>
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={onBack} disabled={phase === 'scanning'}
          className="rounded-lg bg-gray-700 px-4 py-2 text-sm font-medium text-white hover:bg-gray-600 disabled:opacity-30">
          ← Tilbake
        </button>
        {phase === 'preview' && (
          <button onClick={runScan}
            className="flex-1 rounded-xl bg-blue-600 py-3 font-semibold text-white hover:bg-blue-500">
            Skann {scan.groups.length} bilder →
          </button>
        )}
        {phase === 'scanning' && (
          <div className="flex-1 rounded-xl bg-gray-800 py-3 text-center text-sm text-gray-500 animate-pulse">
            Skannar… {stats.scanned} / {scan.groups.length}
          </div>
        )}
        {phase === 'done' && (
          <button onClick={() => onDone(result)} disabled={result.length === 0}
            className="flex-1 rounded-xl bg-blue-600 py-3 font-semibold text-white hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-default">
            {result.length === 0
              ? 'Alle bilder allerede registrert'
              : `Fortsett med ${result.length} nye bilder →`}
          </button>
        )}
      </div>
    </div>
  )
}
