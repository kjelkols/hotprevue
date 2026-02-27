import { useMutation, useQueryClient } from '@tanstack/react-query'
import { addCollectionItemsBatch } from '../../api/collections'
import useSelectionStore from '../../stores/useSelectionStore'

export function useCollectionInsert(collectionId: string) {
  const queryClient = useQueryClient()
  const selected = useSelectionStore(s => s.selected)
  const clearSelection = useSelectionStore(s => s.clear)

  const mutation = useMutation({
    mutationFn: (hothashes: string[]) => addCollectionItemsBatch(collectionId, hothashes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collection-items', collectionId] })
      queryClient.invalidateQueries({ queryKey: ['collection', collectionId] })
      clearSelection()
    },
  })

  return {
    canInsert: selected.size > 0,
    selectedCount: selected.size,
    insert: () => mutation.mutate(Array.from(selected)),
    isPending: mutation.isPending,
  }
}
