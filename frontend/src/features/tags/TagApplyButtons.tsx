import { useState, useRef } from 'react'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { addTagToPhotos, removeTagFromPhotos, listTags } from '../../api/tags'
import useTagSetStore from '../../stores/useTagSetStore'
import useSelectionStore from '../../stores/useSelectionStore'

export default function TagApplyButtons() {
  const queryClient = useQueryClient()
  const { tagIds } = useTagSetStore()
  const selected = useSelectionStore(s => s.selected)
  const hothashes = [...selected]
  const [feedback, setFeedback] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { data: tags = [] } = useQuery({ queryKey: ['tags'], queryFn: listTags })
  const activeNames = tags.filter(t => tagIds.has(t.id)).map(t => t.name)

  function showFeedback(msg: string) {
    if (timerRef.current) clearTimeout(timerRef.current)
    setFeedback(msg)
    timerRef.current = setTimeout(() => setFeedback(null), 3000)
  }

  const addMutation = useMutation({
    mutationFn: async () => {
      for (const tagId of tagIds) await addTagToPhotos(tagId, hothashes)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] })
      queryClient.invalidateQueries({ queryKey: ['tagsForPhotos'] })
      const n = hothashes.length
      showFeedback(`✓ ${activeNames.join(', ')} lagt til ${n} ${n === 1 ? 'bilde' : 'bilder'}`)
    },
  })

  const removeMutation = useMutation({
    mutationFn: async () => {
      for (const tagId of tagIds) await removeTagFromPhotos(tagId, hothashes)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] })
      queryClient.invalidateQueries({ queryKey: ['tagsForPhotos'] })
      const n = hothashes.length
      showFeedback(`✓ Fjernet ${activeNames.join(', ')} fra ${n} ${n === 1 ? 'bilde' : 'bilder'}`)
    },
  })

  if (tagIds.size === 0) return null

  const isPending = addMutation.isPending || removeMutation.isPending

  return (
    <div className="flex items-center gap-2 shrink-0">
      <div className="flex items-center rounded-lg overflow-hidden border border-blue-700">
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
      {feedback && (
        <span className="text-xs text-green-400 animate-pulse whitespace-nowrap">
          {feedback}
        </span>
      )}
    </div>
  )
}
