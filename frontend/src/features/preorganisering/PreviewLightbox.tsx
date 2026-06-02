import { useEffect } from 'react'
import { AGENT_URL } from '../../api/agentClient'

interface Props {
  path: string
  onClose: () => void
}

export default function PreviewLightbox({ path, onClose }: Props) {
  const src = `${AGENT_URL}/process/preview?path=${encodeURIComponent(path)}&maxpx=1600`

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 cursor-zoom-out"
      onClick={onClose}
    >
      <img
        src={src}
        alt=""
        className="max-h-screen max-w-screen object-contain cursor-default"
        onClick={e => e.stopPropagation()}
        draggable={false}
      />
      <button
        onClick={onClose}
        className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/80 text-lg leading-none"
      >
        ×
      </button>
    </div>
  )
}
