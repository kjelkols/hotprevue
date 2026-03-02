import type { PhotoListItem } from '../../types/api'

interface Props {
  photo: PhotoListItem
  selected: boolean
  onToggle(hothash: string): void
}

function LocationBadge({ photo }: { photo: PhotoListItem }) {
  if (photo.location_lat == null) {
    return <span className="text-xs px-1.5 py-0.5 rounded bg-gray-700 text-gray-400">Ingen</span>
  }
  if (photo.location_accuracy === 'exact') {
    return <span className="text-xs px-1.5 py-0.5 rounded bg-blue-900 text-blue-300">GPS</span>
  }
  return <span className="text-xs px-1.5 py-0.5 rounded bg-orange-900 text-orange-300">Manuelt</span>
}

export default function LocationPhotoItem({ photo, selected, onToggle }: Props) {
  return (
    <button
      onClick={() => onToggle(photo.hothash)}
      className={`flex items-center gap-2 w-full px-2 py-1.5 rounded transition-colors text-left ${
        selected ? 'ring-2 ring-blue-500 bg-gray-800' : 'hover:bg-gray-800'
      }`}
    >
      <img
        src={`data:image/jpeg;base64,${photo.hotpreview_b64}`}
        alt=""
        className="w-14 h-14 object-cover rounded shrink-0"
      />
      <div className="flex flex-col gap-1 min-w-0">
        <p className="text-xs text-gray-400 truncate">{photo.hothash.slice(0, 12)}…</p>
        <LocationBadge photo={photo} />
      </div>
    </button>
  )
}
