import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getPhoto } from '../api/photos'
import { getBaseUrl } from '../api/client'
import PhotoMetaPanel from '../features/photos/PhotoMetaPanel'
import ZoomableImage from '../components/ZoomableImage'

export default function PhotoDetailPage() {
  const { hothash } = useParams<{ hothash: string }>()
  const navigate = useNavigate()

  const { data: photo, isLoading, isError } = useQuery({
    queryKey: ['photo', hothash],
    queryFn: () => getPhoto(hothash!),
    enabled: !!hothash,
  })

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950 text-gray-400">
        Laster…
      </div>
    )
  }

  if (isError || !photo) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950 text-red-400">
        Fant ikke bildet.
      </div>
    )
  }

  const coldpreviewUrl = `${getBaseUrl()}/photos/${hothash}/coldpreview`

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-white">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800 shrink-0">
        <button
          onClick={() => navigate(-1)}
          className="text-sm text-gray-400 hover:text-white transition-colors"
        >
          ← Tilbake
        </button>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Left panel: coldpreview (~60%) */}
        <div className="flex-[3] bg-gray-900">
          <ZoomableImage key={hothash} src={coldpreviewUrl} />
        </div>

        {/* Right panel: metadata (~40%) */}
        <div className="flex-[2] overflow-y-auto p-6 border-l border-gray-800">
          <PhotoMetaPanel photo={photo} />
        </div>
      </div>
    </div>
  )
}
