import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface TagSetStore {
  tagIds: Set<string>
  toggle: (id: string) => void
  clear: () => void
}

const useTagSetStore = create<TagSetStore>()(
  persist(
    (set) => ({
      tagIds: new Set<string>(),
      toggle: (id) => set(s => {
        const next = new Set(s.tagIds)
        next.has(id) ? next.delete(id) : next.add(id)
        return { tagIds: next }
      }),
      clear: () => set({ tagIds: new Set() }),
    }),
    {
      name: 'hotprevue-tag-set',
      storage: {
        getItem: (key) => {
          const raw = localStorage.getItem(key)
          if (!raw) return null
          const parsed = JSON.parse(raw)
          parsed.state.tagIds = new Set(parsed.state.tagIds)
          return parsed
        },
        setItem: (key, value) => {
          const serialized = { ...value, state: { ...value.state, tagIds: [...value.state.tagIds] } }
          localStorage.setItem(key, JSON.stringify(serialized))
        },
        removeItem: (key) => localStorage.removeItem(key),
      },
    }
  )
)

export default useTagSetStore
