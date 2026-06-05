import { useEffect, useRef, useState } from 'react'
import ZoomableImage from '../../components/ZoomableImage'

interface Props {
  src: string
  prevHash: string | null
  nextHash: string | null
  currentIndex: number
  total: number
  onExit: () => void
  onPrev: () => void
  onNext: () => void
}

export default function PhotoFullscreen({ src, prevHash, nextHash, currentIndex, total, onExit, onPrev, onNext }: Props) {
  const [showControls, setShowControls] = useState(true)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function revealControls() {
    setShowControls(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setShowControls(false), 3000)
  }

  useEffect(() => {
    revealControls()
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [])

  const ctrl = `transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`

  return (
    <div
      className="fixed inset-0 z-50 bg-black overflow-hidden"
      onMouseMove={revealControls}
      onTouchStart={revealControls}
    >
      <ZoomableImage
        key={src}
        src={src}
        onSwipeLeft={nextHash ? onNext : undefined}
        onSwipeRight={prevHash ? onPrev : undefined}
      />

      <button
        onClick={onExit}
        title="Avslutt fullskjerm (Esc)"
        className={`absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-black/60 hover:bg-black/80 text-white text-lg ${ctrl}`}
      >✕</button>

      <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-6 pb-8 pt-16 ${ctrl}`}>
        <div className="flex items-center justify-between max-w-sm mx-auto">
          <button
            onClick={onPrev}
            disabled={!prevHash}
            className="w-11 h-11 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 disabled:opacity-20 text-2xl text-white"
          >‹</button>
          {total > 0 && (
            <span className="text-sm text-gray-300 tabular-nums">{currentIndex + 1} / {total}</span>
          )}
          <button
            onClick={onNext}
            disabled={!nextHash}
            className="w-11 h-11 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 disabled:opacity-20 text-2xl text-white"
          >›</button>
        </div>
      </div>
    </div>
  )
}
