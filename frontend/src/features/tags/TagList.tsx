import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { deleteTag, renameTag, addTagToPhotos, removeTagFromPhotos } from '../../api/tags'
import TagMergeDialog from './TagMergeDialog'
import type { TagOut } from '../../types/api'

type TriState = 'all' | 'some' | 'none'

interface Props {
  tags: TagOut[]
  selection: string[]             // hothashes — tom = ingen bilder valgt
  tagMap: Record<string, string[]> // hothash → [tag_id, ...]
}

function triState(tagId: string, selection: string[], tagMap: Record<string, string[]>): TriState {
  if (selection.length === 0) return 'none'
  const count = selection.filter(h => (tagMap[h] ?? []).includes(tagId)).length
  if (count === 0) return 'none'
  if (count === selection.length) return 'all'
  return 'some'
}

export default function TagList({ tags, selection, tagMap }: Props) {
  const queryClient = useQueryClient()
  const hasSelection = selection.length > 0
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [mergeTarget, setMergeTarget] = useState<TagOut | null>(null)

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => renameTag(id, name),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tags'] }); setRenaming(null) },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTag(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tags'] }),
  })

  const toggleMutation = useMutation({
    mutationFn: async ({ tagId, state }: { tagId: string; state: TriState }) => {
      if (state === 'all') await removeTagFromPhotos(tagId, selection)
      else await addTagToPhotos(tagId, selection)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tags', 'tagsForPhotos'] }),
  })

  if (tags.length === 0) {
    return <p className="text-sm text-gray-500 py-4 text-center">Ingen tags ennå.</p>
  }

  return (
    <>
      <ul className="flex flex-col gap-1">
        {tags.map(tag => {
          const state = triState(tag.id, selection, tagMap)
          const isRenaming = renaming === tag.id
          return (
            <li key={tag.id} className="flex items-center gap-2 rounded-lg px-3 py-2 bg-gray-800 hover:bg-gray-750 group">
              {hasSelection && (
                <button
                  onClick={() => toggleMutation.mutate({ tagId: tag.id, state })}
                  className="w-5 h-5 flex items-center justify-center rounded border text-xs shrink-0 transition-colors
                    border-gray-500 text-gray-300 hover:border-blue-400"
                  title={state === 'all' ? 'Fjern fra valgte' : 'Legg til på valgte'}
                >
                  {state === 'all' ? '✓' : state === 'some' ? '–' : ''}
                </button>
              )}
              {isRenaming ? (
                <input
                  autoFocus
                  value={renameValue}
                  onChange={e => setRenameValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') renameMutation.mutate({ id: tag.id, name: renameValue })
                    if (e.key === 'Escape') setRenaming(null)
                  }}
                  className="flex-1 bg-gray-700 rounded px-2 py-0.5 text-sm text-white focus:outline-none"
                />
              ) : (
                <span className="flex-1 text-sm text-white">{tag.name}</span>
              )}
              <span className="text-xs text-gray-500 shrink-0">{tag.photo_count}</span>
              <div className="hidden group-hover:flex gap-1 shrink-0">
                <button
                  onClick={() => { setRenaming(tag.id); setRenameValue(tag.name) }}
                  className="px-2 py-0.5 text-xs rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
                >Rename</button>
                <button
                  onClick={() => setMergeTarget(tag)}
                  className="px-2 py-0.5 text-xs rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
                >Merge</button>
                <button
                  onClick={() => deleteMutation.mutate(tag.id)}
                  className="px-2 py-0.5 text-xs rounded bg-gray-700 hover:bg-red-800 text-gray-300 transition-colors"
                >Slett</button>
              </div>
            </li>
          )
        })}
      </ul>
      {mergeTarget && <TagMergeDialog source={mergeTarget} onClose={() => setMergeTarget(null)} />}
    </>
  )
}
