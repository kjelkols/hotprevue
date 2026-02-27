import type { PhotoDetail } from '../../types/api'

function formatDate(taken_at: string | null): string {
  if (!taken_at) return 'Ukjent dato'
  return new Date(taken_at).toLocaleString('no-NO', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function filename(path: string): string {
  return path.split('/').pop() ?? path
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
    <div className="text-sm text-gray-300 space-y-4">
      {master && (
        <p className="font-mono text-xs text-gray-400 truncate">{filename(master.file_path)}</p>
      )}

      <dl className="space-y-2">
        <div>
          <dt className="text-xs text-gray-500">Tidspunkt</dt>
          <dd>{formatDate(photo.taken_at)}</dd>
        </div>

        {(photo.camera_make || photo.camera_model) && (
          <div>
            <dt className="text-xs text-gray-500">Kamera</dt>
            <dd>{[photo.camera_make, photo.camera_model].filter(Boolean).join(' ')}</dd>
          </div>
        )}

        {exposure && (
          <div>
            <dt className="text-xs text-gray-500">Eksponering</dt>
            <dd>{exposure}</dd>
          </div>
        )}

        {photo.focal_length != null && (
          <div>
            <dt className="text-xs text-gray-500">Brennvidde</dt>
            <dd>{photo.focal_length} mm</dd>
          </div>
        )}
      </dl>

      {photo.tags.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 mb-1">Tags</p>
          <div className="flex flex-wrap gap-1">
            {photo.tags.map(tag => (
              <span key={tag} className="bg-gray-700 text-gray-200 rounded px-2 py-0.5 text-xs">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="text-xs text-gray-500 mb-1">Filer</p>
        <ul className="space-y-0.5">
          {photo.image_files.map(f => (
            <li key={f.id} className="flex items-center gap-2 font-mono text-xs">
              <span className={f.is_master ? 'text-blue-400' : 'text-gray-600'}>
                {f.is_master ? '✓' : '·'}
              </span>
              <span className="truncate">{filename(f.file_path)}</span>
              <span className="text-gray-500">({f.file_type})</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
