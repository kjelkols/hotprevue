import { useRef, useState, useEffect } from 'react'

interface Props {
  left: React.ReactNode
  right: React.ReactNode
  defaultSize?: number
  minSize?: number
  maxSize?: number
  storageKey?: string
}

export default function SplitPane({
  left,
  right,
  defaultSize = 300,
  minSize = 150,
  maxSize = 800,
  storageKey,
}: Props) {
  const [size, setSize] = useState(() => {
    if (storageKey) {
      const stored = localStorage.getItem(`splitpane-${storageKey}`)
      if (stored) return Math.max(minSize, Math.min(maxSize, Number(stored)))
    }
    return defaultSize
  })

  const dragging = useRef(false)
  const startX = useRef(0)
  const startSize = useRef(0)

  function handleMouseDown(e: React.MouseEvent) {
    e.preventDefault()
    dragging.current = true
    startX.current = e.clientX
    startSize.current = size
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!dragging.current) return
      const next = Math.max(minSize, Math.min(maxSize, startSize.current + e.clientX - startX.current))
      setSize(next)
      if (storageKey) localStorage.setItem(`splitpane-${storageKey}`, String(next))
    }

    function onMouseUp() {
      if (!dragging.current) return
      dragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [minSize, maxSize, storageKey])

  return (
    <div className="flex h-full overflow-hidden">
      <div style={{ width: size, minWidth: size }} className="shrink-0 overflow-hidden">
        {left}
      </div>
      <div
        onMouseDown={handleMouseDown}
        className="group relative w-1 shrink-0 cursor-col-resize bg-gray-800 hover:bg-blue-600 transition-colors"
      >
        <div className="absolute inset-y-0 -left-1 -right-1" />
      </div>
      <div className="min-w-0 flex-1 overflow-hidden">
        {right}
      </div>
    </div>
  )
}
