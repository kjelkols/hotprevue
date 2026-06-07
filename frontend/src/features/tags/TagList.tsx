import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { deleteTag, renameTag } from '../../api/tags'
import TagMergeDialog from './TagMergeDialog'
import useTagSetStore from '../../stores/useTagSetStore'
import type { TagOut } from '../../types/api'

interface Props {
  tags: TagOut[]
}

export default function TagList({ tags }: Props) {
  const queryClient = useQueryClient()
  const { tagIds, toggle } = useTagSetStore()
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

  if (tags.length === 0) {
    return <p className="text-sm text-gray-500 py-4 text-center">Ingen tags ennå.</p>
  }

  return (
    <>
      <ul className="flex flex-col gap-1">
        {tags.map(tag => {
          const inSet = tagIds.has(tag.id)
          const isRenaming = renaming === tag.id
          return (
            <li
              key={tag.id}
              className={
                'flex items-center gap-3 rounded-xl px-3 py-2.5 group transition-colors cursor-pointer ' +
                (inSet ? 'bg-blue-900/40 hover:bg-blue-900/60' : 'bg-gray-800/60 hover:bg-gray-800')
              }
              onClick={() => { if (renaming !== tag.id) toggle(tag.id) }}
            >
              <span className={
                'w-5 h-5 rounded border flex items-center justify-center shrink-0 text-xs transition-colors ' +
                (inSet ? 'border-blue-400 bg-blue-600 text-white' : 'border-gray-600 text-transparent')
              }>
                ✓
              </span>

              {isRenaming ? (
                <input
                  autoFocus
                  value={renameValue}
                  onClick={e => e.stopPropagation()}
                  onChange={e => setRenameValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') renameMutation.mutate({ id: tag.id, name: renameValue })
                    if (e.key === 'Escape') setRenaming(null)
                  }}
                  className="flex-1 bg-gray-700 rounded px-2 py-0.5 text-sm text-white focus:outline-none"
                />
              ) : (
                <span className={'flex-1 text-sm ' + (inSet ? 'text-blue-100 font-medium' : 'text-gray-200')}>
                  {tag.name}
                </span>
              )}

              <span className="text-xs text-gray-500 shrink-0">{tag.photo_count}</span>

              <div
                className="hidden group-hover:flex gap-1 shrink-0"
                onClick={e => e.stopPropagation()}
              >
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
