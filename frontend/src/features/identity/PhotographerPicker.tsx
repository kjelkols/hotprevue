import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import * as Dialog from '@radix-ui/react-dialog'
import { listPhotographers } from '../../api/photographers'
import useSessionStore from '../../stores/useSessionStore'

/**
 * ADR-012: Sesjonsidentitet.
 *
 * Vises ved oppstart når ingen fotograf er valgt:
 * - 0 fotografer: viser melding om at skriving er blokkert
 * - 1 fotograf:   velger automatisk, ingen dialog
 * - 2+ fotografer: viser liste for manuelt valg
 */
export default function PhotographerPicker() {
  const { selectedPhotographerId, setSelectedPhotographerId } = useSessionStore()
  const [open, setOpen] = useState(false)

  const { data: photographers } = useQuery({
    queryKey: ['photographers'],
    queryFn: listPhotographers,
  })

  useEffect(() => {
    if (!photographers) return

    if (photographers.length === 1 && !selectedPhotographerId) {
      setSelectedPhotographerId(photographers[0].id)
      return
    }

    if (photographers.length > 1 && !selectedPhotographerId) {
      setOpen(true)
    }
  }, [photographers, selectedPhotographerId, setSelectedPhotographerId])

  if (!photographers || photographers.length <= 1) return null

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl bg-gray-900 p-6 shadow-xl border border-gray-700">
          <Dialog.Title className="mb-1 text-lg font-semibold text-white">
            Hvem er du?
          </Dialog.Title>
          <Dialog.Description className="mb-5 text-sm text-gray-400">
            Velg hvem som skal ha æren for endringer du gjør i denne sesjonen.
          </Dialog.Description>

          <div className="space-y-2">
            {photographers.map(p => (
              <button
                key={p.id}
                onClick={() => {
                  setSelectedPhotographerId(p.id)
                  setOpen(false)
                }}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-left text-white hover:border-blue-500 hover:bg-gray-700 transition-colors"
              >
                {p.name}
              </button>
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
