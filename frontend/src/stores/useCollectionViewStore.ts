import { create } from 'zustand'

interface CollectionViewStore {
  activeCollectionId: string | null
  activeCollectionName: string | null
  setActiveCollection: (id: string | null, name: string | null) => void
}

const useCollectionViewStore = create<CollectionViewStore>()(set => ({
  activeCollectionId: null,
  activeCollectionName: null,
  setActiveCollection: (id, name) => set({ activeCollectionId: id, activeCollectionName: name }),
}))

export default useCollectionViewStore
