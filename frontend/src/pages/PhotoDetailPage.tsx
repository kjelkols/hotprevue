import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getPhoto } from '../api/photos'
import { getBaseUrl } from '../api/client'
import PhotoMetaPanel from '../features/photos/PhotoMetaPanel'
import PhotoDownloadShare from '../features/photos/PhotoDownloadShare'
import ZoomableImage from '../components/ZoomableImage'
import SplitPane from '../components/SplitPane'
import usePhotoNavStore from '../stores/usePhotoNavStore'
import { useIsMobile } from '../hooks/useIsMobile'

export default function PhotoDetailPage() {
  const { hothash } = useParams<{ hothash: string }>()
  const navigate = useNavigate()
  const isMobile = useIsMobile()

  const hothashes = usePhotoNavStore(s => s.hothashes)
  const backUrl = usePhotoNavStore(s => s.backUrl)
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
      if (e.key === 'Escape') navigate(backUrl)
      if (e.key === 'ArrowLeft' && prevHash) navigate(`/photos/${prevHash}`)
      if (e.key === 'ArrowRight' && nextHash) navigate(`/photos/${nextHash}`)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [prevHash, nextHash, navigate, backUrl])

  if (isLoading) return <div className="flex h-screen items-center justify-center bg-gray-950 text-gray-400">Laster…</div>
  if (isError || !photo) return <div className="flex h-screen items-center justify-center bg-gray-950 text-red-400">Fant ikke bildet.</div>

  const cacheKey = photo.correction?.updated_at ? +new Date(photo.correction.updated_at) : 0
  const coldpreviewUrl = `${getBaseUrl()}/photos/${hothash}/coldpreview${cacheKey ? `?t=${cacheKey}` : ''}`

  const image = (
    <ZoomableImage
      key={hothash}
      src={coldpreviewUrl}
      onSwipeLeft={nextHash ? () => navigate(`/photos/${nextHash}`) : undefined}
      onSwipeRight={prevHash ? () => navigate(`/photos/${prevHash}`) : undefined}
    />
  )

  if (isMobile) {
    return (
      <div className="flex flex-col h-full bg-gray-950 text-white overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-800 shrink-0">
          <button onClick={() => navigate(backUrl)} className="text-sm text-gray-300 hover:text-white">
            ← Tilbake
          </button>
          <div className="ml-auto flex items-center gap-2">
            <PhotoDownloadShare hothash={hothash!} />
            <button
              onClick={() => prevHash && navigate(`/photos/${prevHash}`)}
              disabled={!prevHash}
              className="w-8 h-8 flex items-center justify-center rounded bg-gray-800 disabled:opacity-30 text-lg"
            >‹</button>
            <button
              onClick={() => nextHash && navigate(`/photos/${nextHash}`)}
              disabled={!nextHash}
              className="w-8 h-8 flex items-center justify-center rounded bg-gray-800 disabled:opacity-30 text-lg"
            >›</button>
          </div>
        </div>
        <div className="bg-black shrink-0 h-[50vh]">{image}</div>
        <div className="flex-1 overflow-y-auto p-4">
          <PhotoMetaPanel photo={photo} />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-gray-950 text-white">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800 shrink-0">
        <button onClick={() => navigate(backUrl)} className="text-sm text-gray-300 hover:text-white transition-colors">
          ← Tilbake
        </button>
        <div className="ml-auto flex items-center gap-3">
          <PhotoDownloadShare hothash={hothash!} />
          {currentIndex >= 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => prevHash && navigate(`/photos/${prevHash}`)}
                disabled={!prevHash}
                className="px-3 py-1 rounded text-sm bg-gray-800 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-default transition-colors"
                title="Forrige (←)"
              >‹ Forrige</button>
              <span className="text-xs text-gray-500">{currentIndex + 1} / {hothashes.length}</span>
              <button
                onClick={() => nextHash && navigate(`/photos/${nextHash}`)}
                disabled={!nextHash}
                className="px-3 py-1 rounded text-sm bg-gray-800 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-default transition-colors"
                title="Neste (→)"
              >Neste ›</button>
            </div>
          )}
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <SplitPane
          left={<div className="h-full bg-gray-900">{image}</div>}
          right={<div className="h-full overflow-y-auto p-6 border-l border-gray-800"><PhotoMetaPanel photo={photo} /></div>}
          defaultSize={700}
          minSize={300}
          maxSize={1400}
          storageKey="photo-detail"
        />
      </div>
    </div>
  )
}
