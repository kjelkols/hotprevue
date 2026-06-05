import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getPhoto } from '../api/photos'
import { getBaseUrl } from '../api/client'
import PhotoMetaPanel from '../features/photos/PhotoMetaPanel'
import PhotoDownloadShare from '../features/photos/PhotoDownloadShare'
import PhotoFullscreen from '../features/photos/PhotoFullscreen'
import ZoomableImage from '../components/ZoomableImage'
import SplitPane from '../components/SplitPane'
import usePhotoNavStore from '../stores/usePhotoNavStore'
import { useIsMobile } from '../hooks/useIsMobile'

function ExpandIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <polyline points="1,5 1,1 5,1" />
      <polyline points="11,1 15,1 15,5" />
      <polyline points="1,11 1,15 5,15" />
      <polyline points="15,11 15,15 11,15" />
    </svg>
  )
}

export default function PhotoDetailPage() {
  const { hothash } = useParams<{ hothash: string }>()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [fullscreen, setFullscreen] = useState(false)

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
      if (e.key === 'Escape') { fullscreen ? setFullscreen(false) : navigate(backUrl); return }
      if (e.key === 'f' || e.key === 'F') { setFullscreen(f => !f); return }
      if (e.key === 'ArrowLeft' && prevHash) navigate(`/photos/${prevHash}`)
      if (e.key === 'ArrowRight' && nextHash) navigate(`/photos/${nextHash}`)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [prevHash, nextHash, navigate, backUrl, fullscreen])

  if (isLoading) return <div className="flex h-screen items-center justify-center bg-gray-950 text-gray-400">Laster…</div>
  if (isError || !photo) return <div className="flex h-screen items-center justify-center bg-gray-950 text-red-400">Fant ikke bildet.</div>

  const cacheKey = photo.correction?.updated_at ? +new Date(photo.correction.updated_at) : 0
  const coldpreviewUrl = `${getBaseUrl()}/photos/${hothash}/coldpreview${cacheKey ? `?t=${cacheKey}` : ''}`

  const onPrev = () => prevHash && navigate(`/photos/${prevHash}`)
  const onNext = () => nextHash && navigate(`/photos/${nextHash}`)

  const image = (
    <ZoomableImage
      key={hothash}
      src={coldpreviewUrl}
      onSwipeLeft={nextHash ? onNext : undefined}
      onSwipeRight={prevHash ? onPrev : undefined}
    />
  )

  const fsButton = (
    <button
      onClick={() => setFullscreen(true)}
      className="p-2 rounded text-gray-300 hover:text-white hover:bg-gray-700"
      title="Fullskjerm (F)"
    ><ExpandIcon /></button>
  )

  if (fullscreen) {
    return (
      <PhotoFullscreen
        src={coldpreviewUrl}
        prevHash={prevHash}
        nextHash={nextHash}
        currentIndex={currentIndex}
        total={hothashes.length}
        onExit={() => setFullscreen(false)}
        onPrev={onPrev}
        onNext={onNext}
      />
    )
  }

  if (isMobile) {
    return (
      <div className="flex flex-col h-full bg-gray-950 text-white overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-800 shrink-0">
          <button onClick={() => navigate(backUrl)} className="text-sm text-gray-300 hover:text-white">
            ← Tilbake
          </button>
          <div className="ml-auto flex items-center gap-2">
            {fsButton}
            <PhotoDownloadShare hothash={hothash!} />
            <button onClick={onPrev} disabled={!prevHash} className="w-8 h-8 flex items-center justify-center rounded bg-gray-800 disabled:opacity-30 text-lg">‹</button>
            <button onClick={onNext} disabled={!nextHash} className="w-8 h-8 flex items-center justify-center rounded bg-gray-800 disabled:opacity-30 text-lg">›</button>
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
          {fsButton}
          <PhotoDownloadShare hothash={hothash!} />
          {currentIndex >= 0 && (
            <div className="flex items-center gap-2">
              <button onClick={onPrev} disabled={!prevHash} className="px-3 py-1 rounded text-sm bg-gray-800 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-default transition-colors" title="Forrige (←)">‹ Forrige</button>
              <span className="text-xs text-gray-500">{currentIndex + 1} / {hothashes.length}</span>
              <button onClick={onNext} disabled={!nextHash} className="px-3 py-1 rounded text-sm bg-gray-800 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-default transition-colors" title="Neste (→)">Neste ›</button>
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
