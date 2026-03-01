import { create } from 'zustand'

export interface NavSource {
  id: string
  type: 'event' | 'session' | 'tag' | 'search'
  label: string
  url: string
}

export interface NavTarget {
  id: string
  type: 'event' | 'collection' | 'tag'
  label: string
  url: string
}

interface NavigationStore {
  sources: NavSource[]
  target: NavTarget | null
  minimized: boolean
  addSource: (source: NavSource) => void
  removeSource: (id: string) => void
  setTarget: (target: NavTarget | null) => void
  toggleMinimized: () => void
  reset: () => void
}

const useNavigationStore = create<NavigationStore>()((set, get) => ({
  sources: [],
  target: null,
  minimized: false,

  addSource: (source) => set(state => {
    // Blocked if already set as target
    if (state.target?.id === source.id) return state
    // Toggle off if already a source
    if (state.sources.some(s => s.id === source.id)) {
      return { sources: state.sources.filter(s => s.id !== source.id) }
    }
    return { sources: [...state.sources, source] }
  }),

  removeSource: (id) => set(state => ({
    sources: state.sources.filter(s => s.id !== id),
  })),

  setTarget: (target) => set(state => {
    if (target === null) return { target: null }
    // Blocked if already set as source
    if (state.sources.some(s => s.id === target.id)) return state
    // Toggle off if already the target
    if (state.target?.id === target.id) return { target: null }
    return { target }
  }),

  toggleMinimized: () => set(state => ({ minimized: !state.minimized })),

  reset: () => set({ sources: [], target: null, minimized: false }),
}))

export default useNavigationStore
