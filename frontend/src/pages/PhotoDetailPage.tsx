import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getPhoto } from '../api/photos'
import { getBaseUrl } from '../api/client'
import PhotoMetaPanel from '../features/photos/PhotoMetaPanel'
import ZoomableImage from '../components/ZoomableImage'
import usePhotoNavStore from '../stores/usePhotoNavStore'

export default function PhotoDetailPage() {
  const { hothash } = useParams<{ hothash: string }>()
  const navigate = useNavigate()

  const hothashes = usePhotoNavStore(s => s.hothashes)
  const currentIndex = hothash ? hothashes.indexOf(hothash) : -1
  const prevHash = currentIndex > 0 ? hothashes[currentIndex - 1] : null
  const nextHash = currentIndex >= 0 && currentIndex < hothashes.length - 1 ? hothashes[currentIndex + 1] : null

  const { data: photo, isLoading, isError } = useQuery({
    queryKey: ['photo', hothash],
    queryFn: () => getPhoto(hothash!),
    enabled: !!hothash,
  })

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft' && prevHash) navigate(`/photos/${prevHash}`)
      if (e.key === 'ArrowRight' && nextHash) navigate(`/photos/${nextHash}`)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [prevHash, nextHash, navigate])

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
    <div className="flex flex-col h-full bg-gray-950 text-white">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800 shrink-0">
        <button
          onClick={() => navigate(-1)}
          className="text-sm text-gray-400 hover:text-white transition-colors"
        >
          ← Tilbake
        </button>

        {currentIndex >= 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={() => prevHash && navigate(`/photos/${prevHash}`)}
              disabled={!prevHash}
              className="px-3 py-1 rounded text-sm bg-gray-800 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-default transition-colors"
              title="Forrige (←)"
            >
              ‹ Forrige
            </button>
            <span className="text-xs text-gray-500">
              {currentIndex + 1} / {hothashes.length}
            </span>
            <button
              onClick={() => nextHash && navigate(`/photos/${nextHash}`)}
              disabled={!nextHash}
              className="px-3 py-1 rounded text-sm bg-gray-800 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-default transition-colors"
              title="Neste (→)"
            >
              Neste ›
            </button>
          </div>
        )}
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
