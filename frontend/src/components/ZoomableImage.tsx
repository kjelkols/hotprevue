import { useRef } from 'react'
import { useImageZoom } from '../hooks/useImageZoom'

interface Props {
  src: string
  alt?: string
}

export default function ZoomableImage({ src, alt = '' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { scale, offsetX, offsetY, isZoomed, onMouseDown } = useImageZoom(containerRef)

  return (
    <div
      ref={containerRef}
      className={['w-full h-full overflow-hidden relative', isZoomed ? 'cursor-grab active:cursor-grabbing' : ''].join(' ')}
      onMouseDown={onMouseDown}
    >
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ transform: `scale(${scale}) translate(${offsetX / scale}px, ${offsetY / scale}px)` }}
      >
        <img
          src={src}
          alt={alt}
          className="max-h-full max-w-full object-contain"
          draggable={false}
        />
      </div>
    </div>
  )
}
