import { useRef } from 'react'
import { getBaseUrl } from '../../api/client'
import type { PhotoSlide } from '../../types/presentation'
import { useZoomPan } from './useZoomPan'

interface Props {
  slide: PhotoSlide
}

export default function PhotoSlideView({ slide }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { scale, offsetX, offsetY, isZoomed, onMouseDown } = useZoomPan(containerRef)
  const src = `${getBaseUrl()}/photos/${slide.hothash}/coldpreview`

  return (
    <div
      ref={containerRef}
      className={['relative w-full h-full overflow-hidden', isZoomed ? 'cursor-grab active:cursor-grabbing' : ''].join(' ')}
      onMouseDown={onMouseDown}
    >
      {/* Inner wrapper fills container so transform-origin is always the viewport center */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6"
        style={{ transform: `scale(${scale}) translate(${offsetX / scale}px, ${offsetY / scale}px)` }}
      >
        <img
          src={src}
          alt=""
          className="max-h-full max-w-full object-contain"
          draggable={false}
        />
        {slide.caption && !isZoomed && (
          <p className="text-sm text-gray-400 italic text-center shrink-0">{slide.caption}</p>
        )}
      </div>
    </div>
  )
}
