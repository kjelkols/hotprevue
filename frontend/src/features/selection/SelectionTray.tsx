import { useState } from 'react'
import useSelectionStore from '../../stores/useSelectionStore'
import useCollectionViewStore from '../../stores/useCollectionViewStore'
import SelectionModal from './SelectionModal'
import CollectionInsertButton from './CollectionInsertButton'

export default function SelectionTray() {
  const selected = useSelectionStore(s => s.selected)
  const clear = useSelectionStore(s => s.clear)
  const activeCollectionId = useCollectionViewStore(s => s.activeCollectionId)
  const activeCollectionName = useCollectionViewStore(s => s.activeCollectionName)
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

        {activeCollectionId && activeCollectionName && (
          <CollectionInsertButton
            collectionId={activeCollectionId}
            collectionName={activeCollectionName}
          />
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
