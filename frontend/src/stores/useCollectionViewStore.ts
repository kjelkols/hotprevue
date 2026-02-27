import { create } from 'zustand'
import { createSelectionSlice, type SelectionSlice } from '../lib/selectionSlice'

interface CollectionViewStore extends SelectionSlice {
  // InsertionPoint — index into the items array where SelectionTray photos will be inserted.
  // null = not active (no insertion point visible)
  insertionIndex: number | null
  setInsertionPoint: (index: number | null) => void
}

const useCollectionViewStore = create<CollectionViewStore>()(set => ({
  ...createSelectionSlice(set),
  insertionIndex: null,
  setInsertionPoint: (index) => set({ insertionIndex: index }),
}))

export default useCollectionViewStore
