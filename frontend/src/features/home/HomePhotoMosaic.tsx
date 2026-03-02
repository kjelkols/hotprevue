import { useNavigate } from 'react-router-dom'
import type { PhotoListItem } from '../../types/api'

interface Props {
  photos: PhotoListItem[]
}

export default function HomePhotoMosaic({ photos }: Props) {
  const navigate = useNavigate()

  if (photos.length === 0) return null

  return (
    <div className="flex flex-col gap-2 items-center">
      <p className="text-xs text-gray-500 uppercase tracking-wider">Tilfeldige glimt</p>
      <div className="flex gap-1">
        {photos.slice(0, 8).map(photo => (
          <button
            key={photo.hothash}
            onClick={() => navigate(`/photos/${photo.hothash}`)}
            className="overflow-hidden rounded transition-opacity hover:opacity-80 shrink-0"
            style={{ width: 80, height: 80 }}
          >
            <img
              src={`data:image/jpeg;base64,${photo.hotpreview_b64}`}
              alt=""
              className="w-full h-full object-cover"
            />
          </button>
        ))}
      </div>
    </div>
  )
}
