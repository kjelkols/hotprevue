import type { PhotoListItem } from '../../types/api'

interface Props {
  photo: PhotoListItem
  onRemove: (hothash: string) => void
}

export default function SelectionThumbnail({ photo, onRemove }: Props) {
  return (
    <div
      className="relative group cursor-pointer"
      onClick={() => onRemove(photo.hothash)}
      title="Klikk for å fjerne fra utvalg"
    >
      <img
        src={`data:image/jpeg;base64,${photo.hotpreview_b64}`}
        alt=""
        className="w-full aspect-square object-cover rounded"
      />
      <div className="absolute inset-0 flex items-center justify-center rounded bg-black/0 group-hover:bg-black/50 transition-colors">
        <span className="text-white text-xl font-bold opacity-0 group-hover:opacity-100 transition-opacity">
          ✕
        </span>
      </div>
    </div>
  )
}
