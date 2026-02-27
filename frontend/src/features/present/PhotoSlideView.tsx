import { getBaseUrl } from '../../api/client'
import type { PhotoSlide } from '../../types/presentation'

interface Props {
  slide: PhotoSlide
}

export default function PhotoSlideView({ slide }: Props) {
  const src = `${getBaseUrl()}/photos/${slide.hothash}/coldpreview`

  return (
    <div className="flex flex-col items-center justify-center w-full h-full gap-4 px-6">
      <img
        src={src}
        alt=""
        className="max-h-full max-w-full object-contain"
        style={{ maxHeight: slide.caption ? 'calc(100% - 2.5rem)' : '100%' }}
      />
      {slide.caption && (
        <p className="text-sm text-gray-400 italic text-center shrink-0">
          {slide.caption}
        </p>
      )}
    </div>
  )
}
