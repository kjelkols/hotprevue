interface Props {
  isActive: boolean
  isPreview: boolean
  onMouseEnter: () => void
  onMouseLeave: () => void
  onClick: () => void
}

export default function CursorEndIndicator({
  isActive,
  isPreview,
  onMouseEnter,
  onMouseLeave,
  onClick,
}: Props) {
  return (
    <div
      className="h-[150px] w-6 flex items-center justify-center cursor-col-resize shrink-0"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
    >
      <div
        className={[
          'w-0.5 h-3/4 rounded-full transition-all duration-150',
          isActive
            ? 'bg-blue-400 shadow-[0_0_6px_theme(colors.blue.400)] opacity-100'
            : isPreview
              ? 'bg-blue-300/50 opacity-100'
              : 'bg-gray-700 opacity-40',
        ].join(' ')}
      />
    </div>
  )
}
