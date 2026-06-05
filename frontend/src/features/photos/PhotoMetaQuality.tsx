import type { PhotoDetail } from '../../types/api'

function pct(v: number) {
  return (v * 100).toFixed(1) + '%'
}

interface Props {
  photo: PhotoDetail
}

export default function PhotoMetaQuality({ photo }: Props) {
  const hasAny =
    photo.sharpness_score != null ||
    photo.exposure_mean != null ||
    photo.exposure_clipping != null ||
    photo.noise_score != null

  if (!hasAny) return null

  return (
    <div>
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">
        Teknisk kvalitet
      </p>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        {photo.sharpness_score != null && (
          <>
            <dt className="text-gray-400">Skarphet</dt>
            <dd className="tabular-nums">{Math.round(photo.sharpness_score)}</dd>
          </>
        )}
        {photo.exposure_mean != null && (
          <>
            <dt className="text-gray-400">Lysstyrke</dt>
            <dd className="tabular-nums">{Math.round(photo.exposure_mean)} / 255</dd>
          </>
        )}
        {photo.exposure_clipping != null && (
          <>
            <dt className="text-gray-400">Klipping</dt>
            <dd className="tabular-nums">{pct(photo.exposure_clipping)}</dd>
          </>
        )}
        {photo.noise_score != null && (
          <>
            <dt className="text-gray-400">Støy</dt>
            <dd className="tabular-nums">{photo.noise_score.toFixed(1)}</dd>
          </>
        )}
      </dl>
    </div>
  )
}
