import type { FileGroup } from '../../types/api'

export interface TreeNode {
  path: string
  name: string
  groups: FileGroup[]    // filer direkte i denne mappen
  children: TreeNode[]   // undermapper
  totalFiles: number     // rekursivt antall
}

export interface NodeState {
  status: 'pending' | 'scanning' | 'done'
  newCount: number
  knownCount: number
  errorCount: number
}

export const DEFAULT_NODE_STATE: NodeState = {
  status: 'pending', newCount: 0, knownCount: 0, errorCount: 0,
}

export function buildTree(rootPath: string, groups: FileGroup[]): TreeNode {
  const byDir = new Map<string, FileGroup[]>()
  for (const g of groups) {
    const dir = g.master_path.substring(0, g.master_path.lastIndexOf('/'))
    const list = byDir.get(dir) ?? []
    list.push(g)
    byDir.set(dir, list)
  }

  const allDirs = new Set([rootPath, ...byDir.keys()])

  function node(path: string): TreeNode {
    const name = path.split('/').filter(Boolean).pop() ?? path
    const nodeGroups = byDir.get(path) ?? []
    const children = [...allDirs]
      .filter(d => d !== path && d.substring(0, d.lastIndexOf('/')) === path)
      .sort()
      .map(node)
    const totalFiles = nodeGroups.length + children.reduce((s, c) => s + c.totalFiles, 0)
    return { path, name, groups: nodeGroups, children, totalFiles }
  }

  return node(rootPath)
}

/** Returnerer alle noder med filer i dybde-først rekkefølge */
export function flatDirs(root: TreeNode): TreeNode[] {
  const result: TreeNode[] = []
  if (root.groups.length > 0) result.push(root)
  for (const child of root.children) result.push(...flatDirs(child))
  return result
}
