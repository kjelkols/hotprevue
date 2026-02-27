import { useEffect, useRef } from 'react'

interface Handlers {
  onNext: () => void
  onPrev: () => void
  onEscape: () => void
  onNotes: () => void
  onFullscreen: () => void
}

export function useSlideKeyboard(handlers: Handlers) {
  const ref = useRef(handlers)
  ref.current = handlers

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      switch (e.key) {
        case 'ArrowRight':
        case ' ':
          e.preventDefault()
          ref.current.onNext()
          break
        case 'ArrowLeft':
          e.preventDefault()
          ref.current.onPrev()
          break
        case 'Escape':
          ref.current.onEscape()
          break
        case 'n':
        case 'N':
          ref.current.onNotes()
          break
        case 'f':
        case 'F':
          ref.current.onFullscreen()
          break
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
