import { useState, useRef, useEffect } from 'react'
import useViewStore, { GRID_VARIANTS } from '../stores/useViewStore'

interface Props {
  disabled?: boolean
}

export default function GridVariantDropdown({ disabled }: Props) {
  const gridVariant = useViewStore(s => s.gridVariant)
  const setGridVariant = useViewStore(s => s.setGridVariant)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const currentLabel = GRID_VARIANTS.find(v => v.value === gridVariant)?.label ?? 'Standard'

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { if (!disabled) setOpen(o => !o) }}
        disabled={disabled}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
          disabled
            ? 'text-gray-600 bg-gray-800 cursor-default'
            : open
              ? 'bg-gray-600 text-white'
              : 'bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700'
        }`}
      >
        {currentLabel}
        <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 py-1 min-w-[120px]">
          {GRID_VARIANTS.map(variant => (
            <button
              key={variant.value}
              onClick={() => { setGridVariant(variant.value); setOpen(false) }}
              className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${
                gridVariant === variant.value
                  ? 'text-white bg-gray-700'
                  : 'text-gray-300 hover:text-white hover:bg-gray-700'
              }`}
            >
              {variant.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
