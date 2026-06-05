import type { PhotoDetail } from '../../types/api'
import PhotoLocationMap from './PhotoLocationMap'
import PhotoMetaQuality from './PhotoMetaQuality'

function formatDate(taken_at: string | null): string {
  if (!taken_at) return 'Ukjent dato'
  return new Date(taken_at).toLocaleString('no-NO', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function formatBytes(bytes: number | null): string | null {
  if (bytes == null) return null
  if (bytes >= 1_000_000) return (bytes / 1_000_000).toFixed(1) + ' MB'
  return Math.round(bytes / 1000) + ' KB'
}

function filename(path: string): string {
  return path.split('/').pop() ?? path
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-yellow-400 tracking-tight">
      {'★'.repeat(rating)}{'☆'.repeat(5 - rating)}
    </span>
  )
}

interface Props {
  photo: PhotoDetail
}

export default function PhotoMetaPanel({ photo }: Props) {
  const master = photo.image_files.find(f => f.is_master)
  const exposure = [
    photo.shutter_speed,
    photo.aperture != null ? `f/${photo.aperture}` : null,
    photo.iso != null ? `ISO ${photo.iso}` : null,
  ].filter(Boolean).join(' · ')

  return (
    <div className="text-sm text-gray-100 space-y-5">
      {master && (
        <p className="font-mono text-xs text-gray-400 truncate">{filename(master.file_path)}</p>
      )}

      <dl className="space-y-3">
        <div>
          <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-0.5">Tidspunkt</dt>
          <dd>{formatDate(photo.taken_at)}</dd>
        </div>

        {(photo.camera_make || photo.camera_model) && (
          <div>
            <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-0.5">Kamera</dt>
            <dd>{[photo.camera_make, photo.camera_model].filter(Boolean).join(' ')}</dd>
          </div>
        )}

        {photo.lens_model && (
          <div>
            <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-0.5">Linse</dt>
            <dd>{photo.lens_model}</dd>
          </div>
        )}

        {exposure && (
          <div>
            <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-0.5">Eksponering</dt>
            <dd>{exposure}</dd>
          </div>
        )}

        {photo.focal_length != null && (
          <div>
            <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-0.5">Brennvidde</dt>
            <dd>{photo.focal_length} mm</dd>
          </div>
        )}

        {photo.width != null && photo.height != null && (
          <div>
            <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-0.5">Oppløsning</dt>
            <dd>{photo.width} × {photo.height}</dd>
          </div>
        )}

        {master?.file_size_bytes != null && (
          <div>
            <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-0.5">Filstørrelse</dt>
            <dd>{formatBytes(master.file_size_bytes)}</dd>
          </div>
        )}

        {photo.rating != null && (
          <div>
            <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-0.5">Vurdering</dt>
            <dd><Stars rating={photo.rating} /></dd>
          </div>
        )}
      </dl>

      {photo.tags.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">Tags</p>
          <div className="flex flex-wrap gap-1">
            {photo.tags.map(tag => (
              <span key={tag} className="bg-gray-700 text-gray-100 rounded px-2 py-0.5 text-xs">{tag}</span>
            ))}
          </div>
        </div>
      )}

      <PhotoLocationMap photo={photo} />

      <PhotoMetaQuality photo={photo} />

      <div>
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">Filer</p>
        <ul className="space-y-1">
          {photo.image_files.map(f => (
            <li key={f.id} className="flex items-center gap-2 font-mono text-xs text-gray-300">
              <span className={f.is_master ? 'text-blue-400' : 'text-gray-600'}>
                {f.is_master ? '✓' : '·'}
              </span>
              <span className="truncate">{filename(f.file_path)}</span>
              <span className="text-gray-500">({f.file_type})</span>
              {f.file_size_bytes != null && !f.is_master && (
                <span className="text-gray-600">{formatBytes(f.file_size_bytes)}</span>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-0.5">Registrert</p>
        <p className="text-gray-400 text-xs">{formatDate(photo.registered_at)}</p>
      </div>
    </div>
  )
}
