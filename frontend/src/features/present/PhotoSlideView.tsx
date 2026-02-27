import { useRef } from 'react'
import { getBaseUrl } from '../../api/client'
import type { PhotoSlide } from '../../types/presentation'
import { useZoomPan } from './useZoomPan'

interface Props {
  slide: PhotoSlide
}

export default function PhotoSlideView({ slide }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const { scale, offsetX, offsetY, isZoomed, canZoomIn, onMouseDown, zoomIn, zoomOut, reset } = useZoomPan(containerRef, imgRef)
  const src = `${getBaseUrl()}/photos/${slide.hothash}/coldpreview`

  return (
    <div
      ref={containerRef}
      className={['relative w-full h-full overflow-hidden', isZoomed ? 'cursor-grab active:cursor-grabbing' : ''].join(' ')}
      onMouseDown={onMouseDown}
    >
      {/* Zoomable layer — only the image, never the caption */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ transform: `scale(${scale}) translate(${offsetX / scale}px, ${offsetY / scale}px)` }}
      >
        <img
          ref={imgRef}
          src={src}
          alt=""
          className="max-h-full max-w-full object-contain"
          draggable={false}
        />
      </div>

      {/* Caption — outside transform, above zoom bar, hidden when zoomed */}
      {slide.caption && !isZoomed && (
        <p className="absolute bottom-14 left-0 right-0 text-center text-sm text-gray-400 italic px-6 pointer-events-none z-20">
          {slide.caption}
        </p>
      )}

      {/* Zoom controls — bottom center, above nav zones (z-10) */}
      <div
        className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center rounded-lg bg-black/60 px-1 py-0.5 select-none"
        onMouseDown={e => e.stopPropagation()}
      >
        <button
          onClick={zoomOut}
          disabled={!isZoomed}
          className="w-7 h-7 flex items-center justify-center text-gray-300 hover:text-white disabled:opacity-30 transition-colors"
        >−</button>
        <span className="w-12 text-center text-xs text-gray-300 tabular-nums">{Math.round(scale * 100)}%</span>
        <button
          onClick={zoomIn}
          disabled={!canZoomIn}
          className="w-7 h-7 flex items-center justify-center text-gray-300 hover:text-white disabled:opacity-30 transition-colors"
        >+</button>
        <div className="w-px h-4 bg-gray-600 mx-1" />
        <button
          onClick={reset}
          disabled={!isZoomed}
          title="Nullstill zoom"
          className="w-7 h-7 flex items-center justify-center text-gray-300 hover:text-white disabled:opacity-30 transition-colors"
        >↺</button>
      </div>
    </div>
  )
}
