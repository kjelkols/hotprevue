import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SessionState {
  selectedPhotographerId: string | null
  setSelectedPhotographerId: (id: string | null) => void
}

const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      selectedPhotographerId: null,
      setSelectedPhotographerId: (id) => set({ selectedPhotographerId: id }),
    }),
    { name: 'hotprevue-session' }
  )
)

export default useSessionStore
