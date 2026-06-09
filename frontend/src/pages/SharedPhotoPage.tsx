import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getSharedPhoto } from '../api/photos'
import { getBaseUrl } from '../api/client'

export default function SharedPhotoPage() {
  const { hothash } = useParams<{ hothash: string }>()

  const { data: photo, isLoading, isError } = useQuery({
    queryKey: ['shared-photo', hothash],
    queryFn: () => getSharedPhoto(hothash!),
    enabled: !!hothash,
    retry: false,
  })

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">
        Laster…
      </div>
    )
  }

  if (isError || !photo) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">
        <div className="text-center">
          <p className="text-lg mb-2">Dette bildet er ikke tilgjengelig.</p>
          <p className="text-sm text-gray-600">Lenken kan ha utløpt eller blitt deaktivert.</p>
        </div>
      </div>
    )
  }

  const imgUrl = `${getBaseUrl()}${photo.coldpreview_url}`
  const takenAt = photo.taken_at ? new Date(photo.taken_at).toLocaleDateString('nb-NO', { year: 'numeric', month: 'long', day: 'numeric' }) : null

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <img
          src={imgUrl}
          alt={photo.share_caption ?? ''}
          className="max-w-full max-h-[80vh] object-contain rounded shadow-2xl"
        />

        <div className="mt-6 text-center max-w-xl">
          {photo.share_caption && (
            <p className="text-lg text-gray-200 mb-2">{photo.share_caption}</p>
          )}
          <div className="flex items-center justify-center gap-3 text-sm text-gray-500 flex-wrap">
            {photo.photographer_name && <span>{photo.photographer_name}</span>}
            {photo.photographer_name && takenAt && <span>·</span>}
            {takenAt && <span>{takenAt}</span>}
            {(photo.camera_make || photo.camera_model) && (
              <>
                <span>·</span>
                <span>{[photo.camera_make, photo.camera_model].filter(Boolean).join(' ')}</span>
              </>
            )}
          </div>

          {photo.share_downloads && (
            <a
              href={`${getBaseUrl()}/share/photo/${hothash}/download`}
              download
              className="mt-4 inline-block rounded-lg px-5 py-2 bg-gray-800 hover:bg-gray-700 text-sm text-gray-200 transition-colors"
            >
              ↓ Last ned
            </a>
          )}
        </div>
      </main>

      <footer className="text-center py-4 text-xs text-gray-700">
        Levert via Hotprevue
      </footer>
    </div>
  )
}
