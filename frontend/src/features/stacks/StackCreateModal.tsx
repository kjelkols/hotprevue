import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createStack } from '../../api/stacks'
import useSelectionStore from '../../stores/useSelectionStore'
import useAssignmentStore from '../../stores/useAssignmentStore'

function isConflictError(err: unknown): boolean {
  return err instanceof Error && err.message.startsWith('409')
}

function conflictMessage(err: unknown): string {
  try {
    const json = JSON.parse((err as Error).message.slice(4).trim())
    return json?.detail ?? 'Noen bilder er allerede i en stack.'
  } catch {
    return 'Noen bilder er allerede i en stack.'
  }
}

export default function StackCreateModal() {
  const qc = useQueryClient()
  const selected = useSelectionStore(s => s.selected)
  const clear = useSelectionStore(s => s.clear)
  const modal = useAssignmentStore(s => s.modal)
  const close = useAssignmentStore(s => s.close)

  const open = modal === 'stack'

  const mutation = useMutation({
    mutationFn: () => createStack(Array.from(selected)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['photos'] })
      qc.invalidateQueries({ queryKey: ['stacks'] })
      clear()
      close()
    },
  })

  if (!open) return null

  const conflict = mutation.isError && isConflictError(mutation.error)

  function handleClose() {
    mutation.reset()
    close()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={handleClose}>
      <div className="w-72 rounded-xl border border-gray-700 bg-gray-900 shadow-xl" onClick={e => e.stopPropagation()}>

        {conflict ? (
          <>
            <div className="p-4">
              <p className="text-sm font-medium text-gray-200 mb-2">Kan ikke opprette stack</p>
              <p className="text-sm text-gray-400">
                {conflictMessage(mutation.error)} Fjern dem fra sin stack først.
              </p>
            </div>
            <div className="flex justify-end p-3 border-t border-gray-800">
              <button type="button" onClick={handleClose} className="rounded-lg bg-gray-700 px-3 py-1.5 text-sm text-white hover:bg-gray-600 transition-colors">
                Avbryt
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="p-4">
              <p className="text-sm font-medium text-gray-300">
                Opprett stack av {selected.size} {selected.size === 1 ? 'bilde' : 'bilder'}
              </p>
            </div>
            <div className="flex justify-end gap-2 p-3 border-t border-gray-800">
              <button type="button" onClick={handleClose} className="rounded-lg px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors">
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
            {mutation.isError && !conflict && (
              <p className="px-4 pb-3 text-xs text-red-400">
                {(mutation.error as Error)?.message ?? 'Feil ved oppretting av stack'}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
