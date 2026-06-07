import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { mergeTags, listTags } from '../../api/tags'
import type { TagOut } from '../../types/api'

interface Props {
  source: TagOut
  onClose: () => void
}

export default function TagMergeDialog({ source, onClose }: Props) {
  const queryClient = useQueryClient()
  const [targetId, setTargetId] = useState('')
  const [filter, setFilter] = useState('')

  const { data: tags = [] } = useQuery({ queryKey: ['tags'], queryFn: listTags })
  const candidates = tags.filter(t => t.id !== source.id && t.name.toLowerCase().includes(filter.toLowerCase()))
  const target = tags.find(t => t.id === targetId)

  const mutation = useMutation({
    mutationFn: () => mergeTags(source.id, targetId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] })
      onClose()
    },
  })

  return (
    <Dialog.Root open onOpenChange={open => { if (!open) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-gray-900 rounded-xl border border-gray-700 p-6 w-full max-w-md shadow-2xl">
          <Dialog.Title className="text-lg font-semibold text-white mb-1">
            Slå sammen tag
          </Dialog.Title>
          <p className="text-sm text-gray-400 mb-4">
            «{source.name}» slås inn i måltag og forsvinner.
          </p>
          <input
            autoFocus
            value={filter}
            onChange={e => { setFilter(e.target.value); setTargetId('') }}
            placeholder="Søk etter måltag…"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gray-500 mb-2"
          />
          <ul className="max-h-48 overflow-y-auto rounded-lg border border-gray-700 mb-4">
            {candidates.map(t => (
              <li
                key={t.id}
                onClick={() => setTargetId(t.id)}
                className={
                  'flex justify-between px-3 py-2 text-sm cursor-pointer transition-colors ' +
                  (t.id === targetId ? 'bg-blue-800 text-white' : 'text-gray-300 hover:bg-gray-800')
                }
              >
                <span>{t.name}</span>
                <span className="text-gray-500 text-xs">{t.photo_count} bilder</span>
              </li>
            ))}
            {candidates.length === 0 && (
              <li className="px-3 py-2 text-sm text-gray-500">Ingen treff</li>
            )}
          </ul>
          {target && (
            <p className="text-xs text-gray-400 mb-3">
              «{source.name}» ({source.photo_count} bilder) slås inn i «{target.name}» ({target.photo_count} bilder).
            </p>
          )}
          {mutation.isError && (
            <p className="text-xs text-red-400 mb-2">
              {mutation.error instanceof Error ? mutation.error.message : 'Feil'}
            </p>
          )}
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 rounded-lg bg-gray-800 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors">
              Avbryt
            </button>
            <button
              disabled={!targetId || mutation.isPending}
              onClick={() => mutation.mutate()}
              className="flex-1 rounded-lg bg-red-700 py-2 text-sm text-white hover:bg-red-600 disabled:opacity-40 transition-colors"
            >
              {mutation.isPending ? 'Slår sammen…' : 'Slå sammen'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
