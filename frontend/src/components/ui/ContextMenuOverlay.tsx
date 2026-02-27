import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom'
import useContextMenuStore, { type ContextMenuItem } from '../../stores/useContextMenuStore'

export default function ContextMenuOverlay() {
  const open = useContextMenuStore(s => s.open)
  const position = useContextMenuStore(s => s.position)
  const items = useContextMenuStore(s => s.items)
  const closeContextMenu = useContextMenuStore(s => s.closeContextMenu)

  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x: 0, y: 0 })

  // Synchronously clamp to viewport before browser paint — avoids flash at wrong position
  useLayoutEffect(() => {
    if (!open) return
    let { x, y } = position
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect()
      if (x + rect.width > window.innerWidth) x = Math.max(8, window.innerWidth - rect.width - 8)
      if (y + rect.height > window.innerHeight) y = Math.max(8, window.innerHeight - rect.height - 8)
    }
    setPos({ x, y })
  }, [open, position])

  // Close on outside mousedown, scroll, or Enter to trigger default
  useEffect(() => {
    if (!open) return
    function onMouseDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeContextMenu()
      }
    }
    function onScroll() { closeContextMenu() }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Enter') {
        const def = items.find(
          (entry): entry is ContextMenuItem => !('type' in entry) && !!entry.isDefault
        )
        if (def) { def.action(); closeContextMenu() }
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    window.addEventListener('scroll', onScroll, true)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('scroll', onScroll, true)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, items, closeContextMenu])

  if (!open) return null

  return ReactDOM.createPortal(
    <div
      ref={menuRef}
      style={{ position: 'fixed', top: pos.y, left: pos.x }}
      className="min-w-[180px] bg-gray-800 border border-gray-700 rounded-lg shadow-xl py-1 z-50"
    >
      {items.map((entry, i) => {
        if ('type' in entry) {
          return <div key={i} className="border-t border-gray-700 my-1" />
        }
        const item = entry as ContextMenuItem
        return (
          <button
            key={item.id}
            disabled={item.disabled}
            onClick={() => { item.action(); closeContextMenu() }}
            className={[
              'w-full text-left px-4 py-2 text-sm text-white hover:bg-gray-700 block',
              item.isDefault ? 'font-semibold' : '',
              item.disabled ? 'opacity-40 pointer-events-none' : '',
            ].join(' ')}
          >
            {item.label}
          </button>
        )
      })}
    </div>,
    document.body
  )
}
