import type { HomeStats } from '../../types/api'

interface Props {
  photographers: HomeStats['photographers']
}

export default function HomePhotographerList({ photographers }: Props) {
  const visible = photographers.filter(p => !p.is_unknown)
  if (visible.length === 0) return null

  const max = Math.max(...visible.map(p => p.photo_count), 1)

  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Fotografer</h2>
      <ul className="flex flex-col gap-1.5">
        {visible.map(p => (
          <li key={p.id} className="flex items-center gap-3 rounded-lg bg-gray-800 px-3 py-2">
            <span className="w-36 truncate text-sm text-white shrink-0">{p.name}</span>
            <div className="flex-1 h-1.5 rounded-full bg-gray-700 overflow-hidden">
              <div
                className="h-full rounded-full bg-blue-600"
                style={{ width: `${Math.max((p.photo_count / max) * 100, 2)}%` }}
              />
            </div>
            <span className="text-xs text-gray-400 tabular-nums shrink-0 w-16 text-right">
              {p.photo_count.toLocaleString('nb-NO')} bilder
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
