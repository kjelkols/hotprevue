import { create } from 'zustand'

export type AssignModal = 'event' | 'collection'

interface AssignmentStore {
  modal: AssignModal | null
  open: (modal: AssignModal) => void
  close: () => void
}

const useAssignmentStore = create<AssignmentStore>(set => ({
  modal: null,
  open: (modal) => set({ modal }),
  close: () => set({ modal: null }),
}))

export default useAssignmentStore
