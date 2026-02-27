import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addCollectionItemsBatch,
  getCollectionItems,
  reorderCollectionItems,
} from '../../api/collections'
import useCollectionViewStore from '../../stores/useCollectionViewStore'
import useSelectionStore from '../../stores/useSelectionStore'

export function useCollectionInsert(collectionId: string) {
  const queryClient = useQueryClient()

  const { data: items = [] } = useQuery({
    queryKey: ['collection-items', collectionId],
    queryFn: () => getCollectionItems(collectionId),
  })

  const insertionIndex = useCollectionViewStore(s => s.insertionIndex)
  const setInsertionPoint = useCollectionViewStore(s => s.setInsertionPoint)
  const selected = useSelectionStore(s => s.selected)
  const clearSelection = useSelectionStore(s => s.clear)

  const resolvedIndex = insertionIndex ?? items.length

  const mutation = useMutation({
    mutationFn: async (hothashes: string[]) => {
      const newItems = await addCollectionItemsBatch(collectionId, hothashes)
      const newIds = newItems.map(i => i.id)
      const existingIds = items.map(i => i.id)
      const newOrder = [
        ...existingIds.slice(0, resolvedIndex),
        ...newIds,
        ...existingIds.slice(resolvedIndex),
      ]
      await reorderCollectionItems(collectionId, newOrder)
      return newIds.length
    },
    onSuccess: count => {
      queryClient.invalidateQueries({ queryKey: ['collection-items', collectionId] })
      clearSelection()
      setInsertionPoint(resolvedIndex + count)
    },
  })

  return {
    canInsert: selected.size > 0,
    selectedCount: selected.size,
    insert: () => mutation.mutate(Array.from(selected)),
    isPending: mutation.isPending,
  }
}
