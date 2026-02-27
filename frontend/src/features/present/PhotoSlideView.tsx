import { getBaseUrl } from '../../api/client'
import type { PhotoSlide } from '../../types/presentation'
import ZoomableImage from '../../components/ZoomableImage'

interface Props {
  slide: PhotoSlide
}

export default function PhotoSlideView({ slide }: Props) {
  const src = `${getBaseUrl()}/photos/${slide.hothash}/coldpreview`

  return (
    <div className="relative w-full h-full">
      <ZoomableImage src={src} />
      {slide.caption && (
        <p className="absolute bottom-4 left-0 right-0 text-center text-sm text-gray-400 italic px-6 pointer-events-none">
          {slide.caption}
        </p>
      )}
    </div>
  )
}
