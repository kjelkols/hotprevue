import type { CSSProperties } from 'react'
import { computePhotoTransformCSS, type CorrectionInput } from '../../lib/photoTransform'

interface ThumbnailShellProps {
  imageData: string
  isSelected: boolean
  correction?: CorrectionInput | null
  onClick: (e: React.MouseEvent) => void
  onDoubleClick: (e: React.MouseEvent) => void
  onContextMenu: (e: React.MouseEvent) => void
  bottomOverlay?: React.ReactNode
  actions?: React.ReactNode
}

export default function ThumbnailShell({
  imageData,
  isSelected,
  correction,
  onClick,
  onDoubleClick,
  onContextMenu,
  bottomOverlay,
  actions,
}: ThumbnailShellProps) {
  const { imgStyle, wrapperStyle } = computePhotoTransformCSS(correction)
  const hasTransform = !!(imgStyle.transform || imgStyle.filter || wrapperStyle.clipPath)

  return (
    <div
      className="relative group cursor-pointer overflow-hidden rounded-sm"
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
    >
      {/* Correction wrapper — clip-path for crop, in post-rotation coordinate space */}
      <div style={wrapperStyle as CSSProperties} className="w-[150px] h-[150px]">
        <img
          src={`data:image/jpeg;base64,${imageData}`}
          alt=""
          style={imgStyle}
          className={`w-[150px] h-[150px] object-cover${!hasTransform ? ' transition-transform duration-150 group-hover:scale-105' : ''}`}
        />
      </div>

      {/* Selection / hover ring */}
      <div className={`absolute inset-0 ring-2 ring-inset pointer-events-none transition-opacity
        ${isSelected ? 'ring-blue-400 opacity-100' : 'ring-blue-400 opacity-0 group-hover:opacity-100'}`}
      />

      {/* Checkmark when selected */}
      {isSelected && (
        <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center pointer-events-none">
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}

      {/* Action buttons — appear on hover, stop click propagation */}
      {actions && (
        <div
          className="absolute top-1 left-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10"
          onClick={e => e.stopPropagation()}
          onDoubleClick={e => e.stopPropagation()}
        >
          {actions}
        </div>
      )}

      {/* Bottom overlay */}
      {bottomOverlay && (
        <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-1 py-0.5 text-[10px] text-gray-200 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          {bottomOverlay}
        </div>
      )}
    </div>
  )
}
