import { create } from 'zustand'

export interface ContextMenuItem {
  id: string
  label: string
  action: () => void
  isDefault?: boolean
  disabled?: boolean
}

export type ContextMenuEntry = ContextMenuItem | { type: 'separator' }

interface ContextMenuStore {
  open: boolean
  position: { x: number; y: number }
  items: ContextMenuEntry[]
  openContextMenu: (payload: { items: ContextMenuEntry[]; position: { x: number; y: number } }) => void
  closeContextMenu: () => void
}

const useContextMenuStore = create<ContextMenuStore>(set => ({
  open: false,
  position: { x: 0, y: 0 },
  items: [],
  openContextMenu: ({ items, position }) => set({ open: true, items, position }),
  closeContextMenu: () => set({ open: false }),
}))

export default useContextMenuStore
