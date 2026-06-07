import { useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { listTags, createTag } from '../../api/tags'
import useTagSetStore from '../../stores/useTagSetStore'

interface Props {
  children: React.ReactNode
}

export default function TagSetPopover({ children }: Props) {
  const queryClient = useQueryClient()
  const { tagIds, toggle, clear } = useTagSetStore()
  const [newTag, setNewTag] = useState('')

  const { data: tags = [] } = useQuery({ queryKey: ['tags'], queryFn: listTags })

  const createMutation = useMutation({
    mutationFn: () => createTag(newTag.trim()),
    onSuccess: (tag) => {
      queryClient.invalidateQueries({ queryKey: ['tags'] })
      toggle(tag.id)
      setNewTag('')
    },
  })

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (newTag.trim()) createMutation.mutate()
  }

  return (
    <Popover.Root>
      <Popover.Trigger asChild>{children}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="top"
          align="end"
          sideOffset={8}
          className="z-50 w-64 rounded-xl bg-gray-900 border border-gray-700 shadow-2xl p-3 flex flex-col gap-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Tag-sett</span>
            {tagIds.size > 0 && (
              <button onClick={clear} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
                Nullstill
              </button>
            )}
          </div>

          <ul className="flex flex-col gap-0.5 max-h-56 overflow-y-auto">
            {tags.map(tag => (
              <li key={tag.id}>
                <button
                  onClick={() => toggle(tag.id)}
                  className={
                    'w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-left transition-colors ' +
                    (tagIds.has(tag.id)
                      ? 'bg-blue-900/60 text-blue-200'
                      : 'text-gray-300 hover:bg-gray-800')
                  }
                >
                  <span className={
                    'w-4 h-4 rounded border flex items-center justify-center shrink-0 text-xs ' +
                    (tagIds.has(tag.id) ? 'border-blue-400 bg-blue-600 text-white' : 'border-gray-600')
                  }>
                    {tagIds.has(tag.id) && '✓'}
                  </span>
                  <span className="flex-1">{tag.name}</span>
                  <span className="text-xs text-gray-500">{tag.photo_count}</span>
                </button>
              </li>
            ))}
            {tags.length === 0 && (
              <li className="text-xs text-gray-500 px-2 py-2">Ingen tags ennå.</li>
            )}
          </ul>

          <div className="border-t border-gray-800 pt-2 flex flex-col gap-2">
            <form onSubmit={handleCreate} className="flex gap-1">
              <input
                value={newTag}
                onChange={e => setNewTag(e.target.value)}
                placeholder="Ny tag…"
                className="flex-1 bg-gray-800 rounded-lg px-2 py-1 text-xs text-white border border-gray-700 focus:outline-none focus:border-gray-500"
              />
              <button
                type="submit"
                disabled={!newTag.trim() || createMutation.isPending}
                className="px-2 py-1 text-xs rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 disabled:opacity-40 transition-colors"
              >+</button>
            </form>
            <Link
              to="/tags"
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors text-center"
            >
              Administrer tags →
            </Link>
          </div>

          <Popover.Arrow className="fill-gray-700" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
