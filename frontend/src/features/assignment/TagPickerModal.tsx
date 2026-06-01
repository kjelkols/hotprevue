import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listTags } from '../../api/tags'
import { batchTagsAdd } from '../../api/photos'
import useSelectionStore from '../../stores/useSelectionStore'
import useAssignmentStore from '../../stores/useAssignmentStore'

export default function TagPickerModal() {
  const [input, setInput] = useState('')
  const [pending, setPending] = useState<string[]>([])
  const qc = useQueryClient()
  const selected = useSelectionStore(s => s.selected)
  const clear = useSelectionStore(s => s.clear)
  const modal = useAssignmentStore(s => s.modal)
  const close = useAssignmentStore(s => s.close)

  const open = modal === 'tag'

  const { data: existingTags = [] } = useQuery({
    queryKey: ['tags'],
    queryFn: listTags,
    enabled: open,
  })

  const mutation = useMutation({
    mutationFn: () => batchTagsAdd(Array.from(selected), pending),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['photos'] })
      qc.invalidateQueries({ queryKey: ['tags'] })
      clear()
      setInput('')
      setPending([])
      close()
    },
  })

  if (!open) return null

  const normalized = input.trim().toLowerCase()
  const suggestions = existingTags
    .filter(t => t.name.includes(normalized) && normalized.length > 0 && !pending.includes(t.name))
    .slice(0, 6)

  function addTag(tag: string) {
    const norm = tag.trim().toLowerCase()
    if (!norm || pending.includes(norm)) return
    setPending(prev => [...prev, norm])
    setInput('')
  }

  function removeTag(tag: string) {
    setPending(prev => prev.filter(t => t !== tag))
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && normalized) {
      e.preventDefault()
      addTag(normalized)
    }
    if (e.key === 'Backspace' && !input && pending.length > 0) {
      removeTag(pending[pending.length - 1])
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={close}>
      <div className="w-80 rounded-xl border border-gray-700 bg-gray-900 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-gray-800">
          <p className="text-sm font-medium text-gray-300 mb-3">
            Legg til tags på {selected.size} {selected.size === 1 ? 'bilde' : 'bilder'}
          </p>
          <div className="flex flex-wrap gap-1.5 min-h-[2.25rem] rounded-lg border border-gray-700 bg-gray-800 px-2 py-1.5 focus-within:border-blue-500">
            {pending.map(tag => (
              <span key={tag} className="flex items-center gap-1 rounded bg-blue-700 px-2 py-0.5 text-xs text-white">
                {tag}
                <button type="button" onClick={() => removeTag(tag)} className="leading-none text-blue-300 hover:text-white">×</button>
              </span>
            ))}
            <input
              autoFocus
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={pending.length === 0 ? 'Skriv tag, trykk Enter…' : ''}
              className="flex-1 min-w-[80px] bg-transparent text-sm text-white outline-none placeholder-gray-600"
            />
          </div>
        </div>
        {suggestions.length > 0 && (
          <ul className="border-b border-gray-800 divide-y divide-gray-800">
            {suggestions.map(t => (
              <li key={t.name}>
                <button
                  type="button"
                  onClick={() => addTag(t.name)}
                  className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-800 transition-colors flex justify-between"
                >
                  <span>{t.name}</span>
                  <span className="text-gray-500 text-xs">{t.photo_count}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex justify-end gap-2 p-3">
          <button type="button" onClick={close} className="rounded-lg px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors">
            Avbryt
          </button>
          <button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={pending.length === 0 || mutation.isPending}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-500 disabled:opacity-40 transition-colors"
          >
            {mutation.isPending ? 'Legger til…' : `Legg til ${pending.length > 0 ? pending.length + ' ' : ''}tag${pending.length !== 1 ? 's' : ''} →`}
          </button>
        </div>
      </div>
    </div>
  )
}
