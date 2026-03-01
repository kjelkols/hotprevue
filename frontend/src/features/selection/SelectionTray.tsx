import { useState } from 'react'
import { useQueryClient, useMutation } from '@tanstack/react-query'
import useSelectionStore from '../../stores/useSelectionStore'
import useNavigationStore from '../../stores/useNavigationStore'
import { useCollectionInsert } from '../collection/useCollectionInsert'
import { assignEvent } from '../../api/photos'
import SelectionModal from './SelectionModal'

function CollectionInsertButton({ collectionId, collectionName }: { collectionId: string; collectionName: string }) {
  const { insert, isPending } = useCollectionInsert(collectionId)
  return (
    <button
      onClick={insert}
      disabled={isPending}
      className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 transition-colors shrink-0"
    >
      {isPending ? 'Setter inn…' : `Sett inn i «${collectionName}»`}
    </button>
  )
}

function EventAssignButton({ eventId, eventName }: { eventId: string; eventName: string }) {
  const queryClient = useQueryClient()
  const selected = useSelectionStore(s => s.selected)
  const clear = useSelectionStore(s => s.clear)

  const mutation = useMutation({
    mutationFn: () => assignEvent(Array.from(selected), eventId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['photos'] })
      queryClient.invalidateQueries({ queryKey: ['event'] })
      clear()
    },
  })

  return (
    <button
      onClick={() => mutation.mutate()}
      disabled={mutation.isPending}
      className="rounded-lg bg-amber-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50 transition-colors shrink-0"
    >
      {mutation.isPending ? 'Flytter…' : `Flytt til «${eventName}»`}
    </button>
  )
}

export default function SelectionTray() {
  const selected = useSelectionStore(s => s.selected)
  const clear = useSelectionStore(s => s.clear)
  const target = useNavigationStore(s => s.target)
  const [modalOpen, setModalOpen] = useState(false)

  if (selected.size === 0) return null

  const count = selected.size

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-40 flex items-center gap-3 bg-gray-900 border-t border-gray-700 px-4 py-3 shadow-lg">
        <span className="text-white font-medium shrink-0">
          {count} {count === 1 ? 'bilde' : 'bilder'} valgt
        </span>

        <button
          onClick={() => setModalOpen(true)}
          className="rounded-lg bg-gray-700 px-3 py-1.5 text-sm text-white hover:bg-gray-600 transition-colors shrink-0"
        >
          Vis utvalg ↑
        </button>

        <div className="flex-1" />

        {target?.type === 'collection' && (
          <CollectionInsertButton collectionId={target.id} collectionName={target.label} />
        )}
        {target?.type === 'event' && (
          <EventAssignButton eventId={target.id} eventName={target.label} />
        )}

        <button
          onClick={clear}
          className="rounded-lg bg-gray-800 px-3 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-gray-700 transition-colors shrink-0"
        >
          Tøm utvalg
        </button>
      </div>

      <SelectionModal open={modalOpen} onOpenChange={setModalOpen} />
    </>
  )
}
