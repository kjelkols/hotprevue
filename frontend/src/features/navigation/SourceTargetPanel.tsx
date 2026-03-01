import { useNavigate } from 'react-router-dom'
import useNavigationStore from '../../stores/useNavigationStore'

export default function SourceTargetPanel() {
  const navigate = useNavigate()
  const sources = useNavigationStore(s => s.sources)
  const target = useNavigationStore(s => s.target)
  const minimized = useNavigationStore(s => s.minimized)
  const removeSource = useNavigationStore(s => s.removeSource)
  const setTarget = useNavigationStore(s => s.setTarget)
  const toggleMinimized = useNavigationStore(s => s.toggleMinimized)
  const reset = useNavigationStore(s => s.reset)

  const hasContent = sources.length > 0 || target !== null
  if (!hasContent) return null

  if (minimized) {
    const parts = []
    if (sources.length > 0) parts.push(`${sources.length} kilde${sources.length !== 1 ? 'r' : ''}`)
    if (target) parts.push('1 mål')
    return (
      <div className="shrink-0 flex items-center gap-2 px-3 h-8 bg-gray-900 border-b border-gray-800 text-xs text-gray-500">
        <button onClick={toggleMinimized} className="hover:text-white transition-colors">
          ▶ {parts.join(', ')}
        </button>
        <div className="ml-auto">
          <button onClick={reset} title="Nullstill kilde/mål" className="text-gray-600 hover:text-gray-300 transition-colors px-1">
            ×
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="shrink-0 flex items-center gap-2 px-3 h-10 bg-gray-900 border-b border-gray-800 text-sm overflow-x-auto">

      {sources.length > 0 && (
        <>
          <span className="text-gray-600 shrink-0 text-xs">Kilde</span>
          {sources.map(src => (
            <span key={src.id} className="flex items-center gap-1 bg-gray-700 rounded px-2 py-0.5 shrink-0">
              <button
                onClick={() => navigate(src.url)}
                className="text-gray-200 hover:text-white transition-colors max-w-[120px] truncate"
                title={src.label}
              >
                {src.label}
              </button>
              <button
                onClick={() => removeSource(src.id)}
                className="text-gray-500 hover:text-gray-200 transition-colors leading-none"
              >
                ×
              </button>
            </span>
          ))}
        </>
      )}

      {sources.length > 0 && target && (
        <span className="text-gray-600 shrink-0">→</span>
      )}

      {target && (
        <>
          <span className="text-gray-600 shrink-0 text-xs">Mål</span>
          <span className="flex items-center gap-1 bg-amber-900/60 border border-amber-700/50 rounded px-2 py-0.5 shrink-0">
            <button
              onClick={() => navigate(target.url)}
              className="text-amber-200 hover:text-white transition-colors max-w-[140px] truncate"
              title={target.label}
            >
              {target.label}
            </button>
            <button
              onClick={() => setTarget(null)}
              className="text-amber-600 hover:text-amber-200 transition-colors leading-none"
            >
              ×
            </button>
          </span>
        </>
      )}

      <div className="ml-auto flex items-center gap-1 shrink-0">
        <button
          onClick={toggleMinimized}
          title="Minimer"
          className="text-gray-600 hover:text-gray-300 transition-colors px-1.5 py-0.5 rounded hover:bg-gray-800"
        >
          —
        </button>
        <button
          onClick={reset}
          title="Nullstill kilde/mål"
          className="text-gray-600 hover:text-gray-300 transition-colors px-1.5 py-0.5 rounded hover:bg-gray-800"
        >
          ×
        </button>
      </div>
    </div>
  )
}
