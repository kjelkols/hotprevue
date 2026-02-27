import { create } from 'zustand'
import { createSelectionSlice, type SelectionSlice } from '../lib/selectionSlice'

interface CollectionViewStore extends SelectionSlice {
  // InsertionPoint — null means "at end of collection" (resolved to items.length in CollectionGrid)
  insertionIndex: number | null
  setInsertionPoint: (index: number | null) => void
  // Set by CollectionGrid on mount/unmount — lets SelectionTray know we're on a collection page
  activeCollectionId: string | null
  setActiveCollectionId: (id: string | null) => void
}

const useCollectionViewStore = create<CollectionViewStore>()(set => ({
  ...createSelectionSlice(set),
  insertionIndex: null,
  setInsertionPoint: (index) => set({ insertionIndex: index }),
  activeCollectionId: null,
  setActiveCollectionId: (id) => set({ activeCollectionId: id }),
}))

export default useCollectionViewStore
