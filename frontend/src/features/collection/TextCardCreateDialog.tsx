import { useState, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createTextItem } from '../../api/text-items'
import { addCollectionItem } from '../../api/collections'

interface Props {
  collectionId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function TextCardCreateDialog({ collectionId, open, onOpenChange }: Props) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const queryClient = useQueryClient()

  // Reset fields each time the dialog opens
  useEffect(() => {
    if (open) { setTitle(''); setBody('') }
  }, [open])

  const mutation = useMutation({
    mutationFn: async () => {
      const t = title.trim()
      const b = body.trim()
      const markup = t && b ? `# ${t}\n\n${b}` : t ? `# ${t}` : b
      const textItem = await createTextItem(markup)
      return addCollectionItem(collectionId, { text_item_id: textItem.id })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collection-items', collectionId] })
      queryClient.invalidateQueries({ queryKey: ['collection', collectionId] })
      onOpenChange(false)
    },
  })

  const canSubmit = title.trim().length > 0 || body.trim().length > 0

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (canSubmit && !mutation.isPending) mutation.mutate()
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 z-40" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-gray-900 border border-gray-700 rounded-lg shadow-xl w-96 p-6 flex flex-col gap-5">
          <Dialog.Title className="text-lg font-semibold text-white">Nytt tekstkort</Dialog.Title>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-gray-400">Tittel</label>
              <input
                autoFocus
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500"
                placeholder="Valgfri tittel"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-gray-400">Tekst</label>
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                rows={4}
                className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500 resize-none"
                placeholder="Valgfri brødtekst"
              />
            </div>
            {mutation.isError && (
              <p className="text-xs text-red-400">Noe gikk galt. Prøv igjen.</p>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <Dialog.Close asChild>
                <button type="button" className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">
                  Avbryt
                </button>
              </Dialog.Close>
              <button
                type="submit"
                disabled={!canSubmit || mutation.isPending}
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded transition-colors"
              >
                {mutation.isPending ? 'Setter inn…' : 'Sett inn'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
