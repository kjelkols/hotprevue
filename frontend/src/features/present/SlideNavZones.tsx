interface Props {
  onPrev: () => void
  onNext: () => void
  canPrev: boolean
  canNext: boolean
}

export default function SlideNavZones({ onPrev, onNext, canPrev, canNext }: Props) {
  return (
    <>
      <div
        onClick={canPrev ? onPrev : undefined}
        className={[
          'absolute left-0 top-0 w-1/2 h-full z-10 flex items-center pl-6 group',
          canPrev ? 'cursor-pointer' : 'pointer-events-none',
        ].join(' ')}
      >
        {canPrev && (
          <span className="text-6xl text-white opacity-0 group-hover:opacity-30 transition-opacity font-thin leading-none select-none">
            ‹
          </span>
        )}
      </div>
      <div
        onClick={canNext ? onNext : undefined}
        className={[
          'absolute right-0 top-0 w-1/2 h-full z-10 flex items-center justify-end pr-6 group',
          canNext ? 'cursor-pointer' : 'pointer-events-none',
        ].join(' ')}
      >
        {canNext && (
          <span className="text-6xl text-white opacity-0 group-hover:opacity-30 transition-opacity font-thin leading-none select-none">
            ›
          </span>
        )}
      </div>
    </>
  )
}
