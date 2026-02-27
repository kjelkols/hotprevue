interface ThumbnailShellProps {
  imageData: string
  isSelected: boolean
  onClick: (e: React.MouseEvent) => void
  onDoubleClick: (e: React.MouseEvent) => void
  onContextMenu: (e: React.MouseEvent) => void
  bottomOverlay?: React.ReactNode
}

export default function ThumbnailShell({
  imageData,
  isSelected,
  onClick,
  onDoubleClick,
  onContextMenu,
  bottomOverlay,
}: ThumbnailShellProps) {
  return (
    <div
      className="relative group cursor-pointer overflow-hidden rounded-sm"
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
    >
      <img
        src={`data:image/jpeg;base64,${imageData}`}
        alt=""
        className="w-[150px] h-[150px] object-cover transition-transform duration-150 group-hover:scale-105"
      />

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

      {/* Bottom overlay (date, caption, …) */}
      {bottomOverlay && (
        <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-1 py-0.5 text-[10px] text-gray-200 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          {bottomOverlay}
        </div>
      )}
    </div>
  )
}
