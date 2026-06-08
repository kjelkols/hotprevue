import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createStack } from '../../api/stacks'
import useSelectionStore from '../../stores/useSelectionStore'
import useAssignmentStore from '../../stores/useAssignmentStore'
import type { StackKind } from '../../types/api'
import { STACK_KIND_LABELS } from '../../types/api'

const KINDS: StackKind[] = ['selection', 'burst', 'panorama', 'hdr', 'focus']

export default function StackCreateModal() {
  const [kind, setKind] = useState<StackKind>('selection')
  const qc = useQueryClient()
  const selected = useSelectionStore(s => s.selected)
  const clear = useSelectionStore(s => s.clear)
  const modal = useAssignmentStore(s => s.modal)
  const close = useAssignmentStore(s => s.close)

  const open = modal === 'stack'

  const mutation = useMutation({
    mutationFn: () => createStack(Array.from(selected), kind),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['photos'] })
      qc.invalidateQueries({ queryKey: ['stacks'] })
      clear()
      setKind('selection')
      close()
    },
  })

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={close}>
      <div className="w-72 rounded-xl border border-gray-700 bg-gray-900 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-gray-800">
          <p className="text-sm font-medium text-gray-300 mb-4">
            Opprett stack av {selected.size} {selected.size === 1 ? 'bilde' : 'bilder'}
          </p>
          <label className="block text-xs text-gray-500 mb-1.5">Stack-type</label>
          <select
            value={kind}
            onChange={e => setKind(e.target.value as StackKind)}
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
          >
            {KINDS.map(k => (
              <option key={k} value={k}>{STACK_KIND_LABELS[k]}</option>
            ))}
          </select>
        </div>
        <div className="flex justify-end gap-2 p-3 border-t border-gray-800">
          <button type="button" onClick={close} className="rounded-lg px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors">
            Avbryt
          </button>
          <button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-500 disabled:opacity-40 transition-colors"
          >
            {mutation.isPending ? 'Oppretter…' : 'Opprett stack →'}
          </button>
        </div>
        {mutation.isError && (
          <p className="px-4 pb-3 text-xs text-red-400">
            {(mutation.error as Error)?.message ?? 'Feil ved oppretting av stack'}
          </p>
        )}
      </div>
    </div>
  )
}
