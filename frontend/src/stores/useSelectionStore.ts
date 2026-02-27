import { create } from 'zustand'
import { createSelectionSlice, type SelectionSlice } from '../lib/selectionSlice'

const useSelectionStore = create<SelectionSlice>()(set =>
  createSelectionSlice(set)
)

export default useSelectionStore
