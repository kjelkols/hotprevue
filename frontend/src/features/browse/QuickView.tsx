import { useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import type { PhotoListItem } from '../../types/api'
import usePhotoNavStore from '../../stores/usePhotoNavStore'

const MAX_PHOTOS = 10_000

interface Props {
  photos: PhotoListItem[]
  isLoading: boolean
  hasMore?: boolean
  onLoadMore?: () => void
}

export default function QuickView({ photos, isLoading, hasMore, onLoadMore }: Props) {
  const navigate = useNavigate()
  const location = useLocation()
  const setHothashes = usePhotoNavStore(s => s.setHothashes)
  const setBackUrl = usePhotoNavStore(s => s.setBackUrl)
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!onLoadMore || !hasMore) return
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) onLoadMore()
    })
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, onLoadMore])

  if (isLoading && photos.length === 0) {
    return <div className="flex items-center justify-center py-20 text-sm text-gray-400">Søker…</div>
  }

  if (!isLoading && photos.length === 0) {
    return <div className="flex items-center justify-center py-20 text-sm text-gray-500">Ingen bilder funnet.</div>
  }

  const visible = photos.slice(0, MAX_PHOTOS)
  const hothashes = visible.map(p => p.hothash)

  function handleClick(hothash: string) {
    setHothashes(hothashes)
    setBackUrl(location.pathname + location.search)
    navigate(`/photos/${hothash}`)
  }

  return (
    <div>
      {photos.length > MAX_PHOTOS && (
        <div className="mb-3 rounded-lg border border-yellow-700/50 bg-yellow-900/20 px-3 py-2 text-sm text-yellow-400">
          Viser de første {MAX_PHOTOS.toLocaleString('nb-NO')} bildene. Legg til flere kriterier for å snevre inn.
        </div>
      )}
      <div className="grid gap-0.5" style={{ gridTemplateColumns: 'repeat(auto-fill, 80px)' }}>
        {visible.map(photo => (
          <div
            key={photo.hothash}
            onClick={() => handleClick(photo.hothash)}
            className="cursor-pointer overflow-hidden bg-gray-800"
            style={{ width: 80, height: 80 }}
          >
            <img
              src={`data:image/jpeg;base64,${photo.hotpreview_b64}`}
              alt=""
              className="h-full w-full object-cover"
              draggable={false}
            />
          </div>
        ))}
      </div>
      <div ref={sentinelRef} className="h-1" />
    </div>
  )
}
