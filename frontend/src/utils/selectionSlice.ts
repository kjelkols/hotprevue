// Shared selection state and actions used by both useSelectionStore and useCollectionViewStore.
// Both stores have the same click-model (plain / ctrl / shift) but different ID types
// (hothash for photos, CollectionItem UUID for collections).

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySet = (partial: any) => void

export interface SelectionSlice {
  selected: Set<string>
  anchor: string | null
  selectOnly: (id: string) => void
  toggleOne: (id: string) => void
  selectRange: (id: string, orderedIds: string[]) => void
  selectAll: (ids: string[]) => void
  clear: () => void
}

export function createSelectionSlice(set: AnySet): SelectionSlice {
  return {
    selected: new Set(),
    anchor: null,

    selectOnly: (id) =>
      set(() => ({ selected: new Set([id]), anchor: id })),

    toggleOne: (id) =>
      set((state: SelectionSlice) => {
        const next = new Set(state.selected)
        const nowSelected = !next.has(id)
        if (nowSelected) next.add(id)
        else next.delete(id)
        return { selected: next, anchor: nowSelected ? id : state.anchor }
      }),

    selectRange: (id, orderedIds) =>
      set((state: SelectionSlice) => {
        const anchorIndex = state.anchor ? orderedIds.indexOf(state.anchor) : -1
        const targetIndex = orderedIds.indexOf(id)
        if (anchorIndex === -1 || targetIndex === -1) {
          return { selected: new Set([id]), anchor: id }
        }
        const from = Math.min(anchorIndex, targetIndex)
        const to = Math.max(anchorIndex, targetIndex)
        return { selected: new Set(orderedIds.slice(from, to + 1)) }
      }),

    selectAll: (ids) =>
      set(() => ({ selected: new Set(ids), anchor: ids[ids.length - 1] ?? null })),

    clear: () =>
      set(() => ({ selected: new Set<string>(), anchor: null })),
  }
}
