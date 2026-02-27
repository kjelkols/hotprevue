import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { Slide } from '../../types/presentation'
import PhotoSlideView from './PhotoSlideView'
import TextSlideView from './TextSlideView'
import SlideNotesPanel from './SlideNotesPanel'
import SlideNavZones from './SlideNavZones'
import { useSlideKeyboard } from './useSlideKeyboard'

const FADE_MS = 150

interface Props {
  slides: Slide[]
  collectionName: string
  onClose: () => void
}

export default function SlidePresenter({ slides, collectionName, onClose }: Props) {
  const [searchParams, setSearchParams] = useSearchParams()
  const initial = Math.max(0, Math.min(parseInt(searchParams.get('slide') ?? '0', 10), slides.length - 1))

  const [slideIndex, setSlideIndex] = useState(initial)
  const [opacity, setOpacity] = useState(1)
  const [notesOpen, setNotesOpen] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingRef = useRef<number | null>(null)

  useEffect(() => {
    setSearchParams({ slide: String(slideIndex) }, { replace: true })
  }, [slideIndex, setSearchParams])

  function navigateTo(index: number) {
    if (index < 0 || index >= slides.length) return
    pendingRef.current = index
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setOpacity(0)
    timeoutRef.current = setTimeout(() => {
      if (pendingRef.current !== null) { setSlideIndex(pendingRef.current); pendingRef.current = null }
      setOpacity(1)
    }, FADE_MS)
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen()
    else document.exitFullscreen()
  }

  useSlideKeyboard({
    onNext: () => navigateTo(slideIndex + 1),
    onPrev: () => navigateTo(slideIndex - 1),
    onEscape: onClose,
    onNotes: () => setNotesOpen(v => !v),
    onFullscreen: toggleFullscreen,
  })

  if (slides.length === 0) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center text-gray-500">
        <p>Ingen slides</p>
      </div>
    )
  }

  const slide = slides[slideIndex]
  const hasNotes = Boolean(slide.notes)

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col select-none">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-3 bg-black/60 border-b border-white/5">
        <button onClick={onClose} className="text-sm text-gray-400 hover:text-white transition-colors shrink-0">
          ← Tilbake
        </button>
        <span className="flex-1 text-sm text-gray-300 font-medium text-center truncate px-2">
          {collectionName}
        </span>
        <span className="text-sm text-gray-500 shrink-0">{slideIndex + 1} / {slides.length}</span>
        <button
          onClick={() => setNotesOpen(v => !v)}
          className={['text-xs px-2 py-1 rounded transition-colors shrink-0',
            hasNotes
              ? notesOpen ? 'bg-blue-700 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              : 'text-gray-600 cursor-default',
          ].join(' ')}
          title="Notater (N)"
        >
          N
        </button>
        <button onClick={() => navigateTo(slideIndex - 1)} disabled={slideIndex === 0}
          className="text-gray-400 hover:text-white disabled:opacity-20 transition-colors px-1 shrink-0">←</button>
        <button onClick={() => navigateTo(slideIndex + 1)} disabled={slideIndex === slides.length - 1}
          className="text-gray-400 hover:text-white disabled:opacity-20 transition-colors px-1 shrink-0">→</button>
      </div>

      {/* Slide */}
      <div className="relative flex-1 min-h-0" style={{ opacity, transition: `opacity ${FADE_MS}ms ease` }}>
        <SlideNavZones
          onPrev={() => navigateTo(slideIndex - 1)}
          onNext={() => navigateTo(slideIndex + 1)}
          canPrev={slideIndex > 0}
          canNext={slideIndex < slides.length - 1}
        />
        {slide.kind === 'photo'
          ? <PhotoSlideView key={slide.collection_item_id} slide={slide} />
          : <TextSlideView slide={slide} />}
      </div>

      {/* Notes */}
      {notesOpen && hasNotes && <SlideNotesPanel notes={slide.notes!} />}
    </div>
  )
}
