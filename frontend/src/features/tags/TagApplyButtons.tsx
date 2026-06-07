import { useMutation, useQueryClient } from '@tanstack/react-query'
import { addTagToPhotos, removeTagFromPhotos } from '../../api/tags'
import useTagSetStore from '../../stores/useTagSetStore'
import useSelectionStore from '../../stores/useSelectionStore'

export default function TagApplyButtons() {
  const queryClient = useQueryClient()
  const { tagIds } = useTagSetStore()
  const selected = useSelectionStore(s => s.selected)
  const hothashes = [...selected]

  const addMutation = useMutation({
    mutationFn: async () => {
      for (const tagId of tagIds) {
        await addTagToPhotos(tagId, hothashes)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] })
      queryClient.invalidateQueries({ queryKey: ['tagsForPhotos'] })
    },
  })

  const removeMutation = useMutation({
    mutationFn: async () => {
      for (const tagId of tagIds) {
        await removeTagFromPhotos(tagId, hothashes)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] })
      queryClient.invalidateQueries({ queryKey: ['tagsForPhotos'] })
    },
  })

  if (tagIds.size === 0) return null

  const isPending = addMutation.isPending || removeMutation.isPending

  return (
    <div className="flex items-center rounded-lg overflow-hidden border border-blue-700 shrink-0">
      <button
        onClick={() => addMutation.mutate()}
        disabled={isPending}
        className="px-3 py-1.5 text-sm text-blue-200 hover:bg-blue-900/60 transition-colors disabled:opacity-50"
      >
        Legg til
      </button>
      <div className="w-px bg-blue-700" />
      <button
        onClick={() => removeMutation.mutate()}
        disabled={isPending}
        className="px-3 py-1.5 text-sm text-blue-200 hover:bg-blue-900/60 transition-colors disabled:opacity-50"
      >
        Fjern
      </button>
    </div>
  )
}
