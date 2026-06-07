import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as Dialog from '@radix-ui/react-dialog'
import { createKind, patchKind } from '../../api/kinds'
import type { KindOut } from '../../types/api'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  kind?: KindOut
}

const inputCls = 'w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-gray-500'

export default function KindDialog({ open, onOpenChange, kind }: Props) {
  const queryClient = useQueryClient()
  const isEdit = !!kind

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState('#6b7280')
  const [hiddenByDefault, setHiddenByDefault] = useState(false)

  useEffect(() => {
    if (open) {
      setName(kind?.name ?? '')
      setDescription(kind?.description ?? '')
      setColor(kind?.color ?? '#6b7280')
      setHiddenByDefault(kind?.hidden_by_default ?? false)
    }
  }, [open])

  const mutation = useMutation({
    mutationFn: () => {
      const data = {
        name: name.trim(),
        description: description.trim() || null,
        color,
        hidden_by_default: hiddenByDefault,
      }
      return isEdit ? patchKind(kind!.id, data) : createKind(data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kinds'] })
      onOpenChange(false)
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    mutation.mutate()
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-gray-900 rounded-xl border border-gray-700 p-6 w-full max-w-md shadow-2xl">
          <Dialog.Title className="text-lg font-semibold text-white mb-4">
            {isEdit ? 'Rediger kind' : 'Nytt kind'}
          </Dialog.Title>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Navn *</label>
              <input autoFocus value={name} onChange={e => setName(e.target.value)} className={inputCls} placeholder="F.eks. Sopp, Screenshots" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Beskrivelse</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className={inputCls + ' resize-none'} placeholder="Valgfritt" />
            </div>
            <div className="flex items-center gap-3">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Farge</label>
                <input type="color" value={color} onChange={e => setColor(e.target.value)} className="h-9 w-16 rounded cursor-pointer bg-gray-800 border border-gray-700 p-0.5" />
              </div>
              <div className="flex-1 flex items-center gap-2 mt-5">
                <input
                  type="checkbox"
                  id="hidden-by-default"
                  checked={hiddenByDefault}
                  onChange={e => setHiddenByDefault(e.target.checked)}
                  className="accent-blue-500"
                />
                <label htmlFor="hidden-by-default" className="text-sm text-gray-300 cursor-pointer">
                  Skjult som standard
                </label>
              </div>
            </div>
            {mutation.isError && (
              <p className="text-sm text-red-400">
                {mutation.error instanceof Error ? mutation.error.message : 'Feil'}
              </p>
            )}
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => onOpenChange(false)} className="flex-1 rounded-lg bg-gray-800 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors">
                Avbryt
              </button>
              <button type="submit" disabled={!name.trim() || mutation.isPending} className="flex-1 rounded-lg bg-blue-600 py-2 text-sm text-white hover:bg-blue-500 disabled:opacity-50 transition-colors">
                {mutation.isPending ? 'Lagrer…' : isEdit ? 'Lagre' : 'Opprett'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
