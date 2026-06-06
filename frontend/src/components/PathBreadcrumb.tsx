interface Props {
  path: string
  onNavigate: (path: string) => void
}

const MAX_SEGMENTS = 4

export default function PathBreadcrumb({ path, onNavigate }: Props) {
  if (!path) return <span className="text-gray-600 text-sm">…</span>

  const parts = path.split('/').filter(Boolean)
  const segments = parts.map((name, i) => ({
    name,
    path: '/' + parts.slice(0, i + 1).join('/'),
  }))

  const truncated = segments.length > MAX_SEGMENTS
  const shown = truncated ? segments.slice(-MAX_SEGMENTS) : segments

  return (
    <nav className="flex items-center min-w-0 overflow-hidden">
      {truncated && <span className="text-gray-600 text-sm shrink-0 mr-0.5">…</span>}
      {shown.map((seg, i) => {
        const isLast = i === shown.length - 1
        return (
          <span key={seg.path} className="flex items-center shrink-0 last:min-w-0 last:overflow-hidden">
            {i > 0 && <span className="text-gray-700 text-sm px-0.5">/</span>}
            {isLast
              ? <span className="text-white font-semibold text-sm truncate" title={seg.path}>{seg.name}</span>
              : <button onClick={() => onNavigate(seg.path)} title={seg.path}
                  className="text-gray-500 hover:text-white text-sm transition-colors max-w-[5rem] truncate">
                  {seg.name}
                </button>
            }
          </span>
        )
      })}
    </nav>
  )
}
