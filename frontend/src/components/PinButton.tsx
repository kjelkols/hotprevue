import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listShortcuts, createShortcut, deleteShortcut } from '../api/shortcuts'

interface Props {
  path: string
}

export default function PinButton({ path }: Props) {
  const [editing, setEditing] = useState(false)
  const [label, setLabel] = useState('')
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: ['shortcuts'] })

  const { data: shortcuts = [] } = useQuery({ queryKey: ['shortcuts'], queryFn: listShortcuts })
  const existing = shortcuts.find(s => s.path === path)
  const basename = path.split('/').filter(Boolean).pop() ?? path

  const createMut = useMutation({
    mutationFn: createShortcut,
    onSuccess: () => { invalidate(); setEditing(false); setLabel('') },
  })
  const deleteMut = useMutation({
    mutationFn: deleteShortcut,
    onSuccess: invalidate,
  })

  function confirm() {
    createMut.mutate({ name: label.trim() || basename, path })
  }

  function cancel() { setEditing(false); setLabel('') }

  if (!path) return null

  if (existing) {
    return (
      <button
        onClick={() => deleteMut.mutate(existing.id)}
        title={`Fjern «${existing.name}» fra snarveier`}
        className="shrink-0 px-1 text-blue-400 hover:text-red-400 transition-colors"
      >
        📌
      </button>
    )
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-xs text-gray-300 font-mono">{basename}</span>
        <input
          autoFocus
          type="text"
          value={label}
          onChange={e => setLabel(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') confirm(); if (e.key === 'Escape') cancel() }}
          placeholder="etikett (valgfri)"
          className="w-28 rounded border border-gray-600 bg-gray-800 px-1.5 py-0.5 text-xs text-white outline-none focus:border-blue-500"
        />
        <button onClick={confirm} disabled={createMut.isPending}
          className="px-0.5 text-sm text-blue-400 hover:text-blue-300">✓</button>
        <button onClick={cancel}
          className="px-0.5 text-sm text-gray-500 hover:text-gray-300">✕</button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setEditing(true)}
      title="Legg til som snarvei"
      className="shrink-0 px-1 text-gray-500 hover:text-blue-400 transition-colors"
    >
      📌
    </button>
  )
}
