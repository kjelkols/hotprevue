import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as Dialog from '@radix-ui/react-dialog'
import { createPhotographer, patchPhotographer } from '../../api/photographers'
import type { Photographer } from '../../types/api'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  photographer?: Photographer
}

const inputCls = 'w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-gray-500'

export default function PhotographerDialog({ open, onOpenChange, photographer }: Props) {
  const queryClient = useQueryClient()
  const isEdit = !!photographer

  const [name, setName] = useState('')
  const [website, setWebsite] = useState('')
  const [bio, setBio] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (open) {
      setName(photographer?.name ?? '')
      setWebsite(photographer?.website ?? '')
      setBio(photographer?.bio ?? '')
      setNotes(photographer?.notes ?? '')
    }
  }, [open])

  const mutation = useMutation({
    mutationFn: () => {
      const data = {
        name: name.trim(),
        website: website.trim() || null,
        bio: bio.trim() || null,
        notes: notes.trim() || null,
      }
      return isEdit ? patchPhotographer(photographer!.id, data) : createPhotographer(data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['photographers'] })
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
            {isEdit ? 'Rediger fotograf' : 'Ny fotograf'}
          </Dialog.Title>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Navn *</label>
              <input autoFocus value={name} onChange={e => setName(e.target.value)} className={inputCls} placeholder="Navn" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Nettside</label>
              <input value={website} onChange={e => setWebsite(e.target.value)} className={inputCls} placeholder="https://…" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Bio</label>
              <textarea value={bio} onChange={e => setBio(e.target.value)} rows={2} className={inputCls + ' resize-none'} placeholder="Valgfritt" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Notater</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={inputCls + ' resize-none'} placeholder="Interne notater" />
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
