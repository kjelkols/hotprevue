import { useState } from 'react'
import { useQueryClient, useMutation } from '@tanstack/react-query'
import * as Dialog from '@radix-ui/react-dialog'
import { createEvent } from '../../api/events'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function EventCreateDialog({ open, onOpenChange }: Props) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')

  const mutation = useMutation({
    mutationFn: () => createEvent({
      name,
      date: date || null,
      location: location || null,
      description: description || null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] })
      onOpenChange(false)
      setName('')
      setDate('')
      setLocation('')
      setDescription('')
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
          <Dialog.Title className="text-lg font-semibold text-white mb-4">Nytt event</Dialog.Title>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Navn *</label>
              <input
                autoFocus
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-gray-500"
                placeholder="Navn på event"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Dato</label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-gray-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Sted</label>
                <input
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-gray-500"
                  placeholder="Valgfritt"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Beskrivelse</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={2}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-gray-500 resize-none"
                placeholder="Valgfritt"
              />
            </div>
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="flex-1 rounded-lg bg-gray-800 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors"
              >
                Avbryt
              </button>
              <button
                type="submit"
                disabled={!name.trim() || mutation.isPending}
                className="flex-1 rounded-lg bg-blue-600 py-2 text-sm text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
              >
                {mutation.isPending ? 'Oppretter…' : 'Opprett'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
