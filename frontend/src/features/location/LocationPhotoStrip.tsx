import type { PhotoListItem } from '../../types/api'
import useLocationEditorStore from '../../stores/useLocationEditorStore'
import useSelectionStore from '../../stores/useSelectionStore'
import LocationPhotoItem from './LocationPhotoItem'

interface Props {
  photos: PhotoListItem[]
  stripSelected: Set<string>
  onToggle(hothash: string): void
  onSetSelected(hothashes: Set<string>): void
}

export default function LocationPhotoStrip({ photos, stripSelected, onToggle, onSetSelected }: Props) {
  const addPhotos = useLocationEditorStore(s => s.addPhotos)
  const clearPhotos = useLocationEditorStore(s => s.clearPhotos)
  const globalSelected = useSelectionStore(s => s.selected)

  function selectAllWithoutLocation() {
    const without = new Set(photos.filter(p => p.location_lat == null).map(p => p.hothash))
    onSetSelected(without)
  }

  function fetchFromSelection() {
    addPhotos(Array.from(globalSelected))
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-col gap-1 p-2 border-b border-gray-800 shrink-0">
        <button
          onClick={selectAllWithoutLocation}
          className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-2 py-1 rounded transition-colors text-left"
        >
          Velg alle uten sted
        </button>
        <button
          onClick={fetchFromSelection}
          className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-2 py-1 rounded transition-colors text-left"
        >
          Hent fra utvalg
        </button>
        <button
          onClick={clearPhotos}
          className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-2 py-1 rounded transition-colors text-left"
        >
          Tøm
        </button>
      </div>
      <div className="overflow-y-auto flex-1 p-1">
        {photos.length === 0 ? (
          <p className="text-gray-600 text-sm text-center py-8">Ingen bilder.</p>
        ) : (
          photos.map(photo => (
            <LocationPhotoItem
              key={photo.hothash}
              photo={photo}
              selected={stripSelected.has(photo.hothash)}
              onToggle={onToggle}
            />
          ))
        )}
      </div>
    </div>
  )
}
