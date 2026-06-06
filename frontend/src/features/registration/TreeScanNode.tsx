import type { TreeNode, NodeState } from './treeUtils'

interface Props {
  node: TreeNode
  depth: number
  getState: (path: string) => NodeState
}

export default function TreeScanNode({ node, depth, getState }: Props) {
  if (node.totalFiles === 0) return null

  const s = node.groups.length > 0 ? getState(node.path) : null

  const [icon, iconCls] = !s
    ? ['', '']
    : s.status === 'scanning'
    ? ['◌', 'text-blue-400 animate-pulse']
    : s.status === 'done'
    ? s.errorCount > 0
      ? ['✕', 'text-red-400']
      : s.newCount > 0
      ? ['●', 'text-green-400']
      : ['✓', 'text-gray-600']
    : ['○', 'text-gray-700']

  const nameCls = !s
    ? 'text-gray-400'
    : s.status === 'scanning'
    ? 'text-blue-200'
    : s.status === 'done'
    ? s.newCount > 0 ? 'text-white' : 'text-gray-500'
    : 'text-gray-400'

  return (
    <div>
      {node.groups.length > 0 && (
        <div
          className="flex items-center gap-2.5 py-1.5 px-2 rounded hover:bg-gray-800/40"
          style={{ paddingLeft: 8 + depth * 20 }}
        >
          <span className={`shrink-0 text-xs w-3 text-center ${iconCls}`}>{icon}</span>
          <span className={`flex-1 truncate text-sm ${depth === 0 ? 'font-semibold' : ''} ${nameCls}`}>
            {node.name}
          </span>
          <span className="text-xs shrink-0 tabular-nums">
            {s?.status === 'done' ? (
              <span className={s.newCount > 0 ? 'text-green-400' : 'text-gray-600'}>
                {s.newCount > 0 && `${s.newCount} ny`}
                {s.newCount > 0 && s.knownCount > 0 && <span className="text-gray-700"> · </span>}
                {s.knownCount > 0 && <span className="text-gray-600">{s.knownCount} kjent</span>}
                {s.errorCount > 0 && <span className="text-red-400"> · {s.errorCount} feil</span>}
              </span>
            ) : (
              <span className="text-gray-700">{node.groups.length}</span>
            )}
          </span>
        </div>
      )}
      {node.children.map(child => (
        <TreeScanNode key={child.path} node={child} depth={depth + 1} getState={getState} />
      ))}
    </div>
  )
}
