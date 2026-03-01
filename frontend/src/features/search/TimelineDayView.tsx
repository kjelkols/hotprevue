import { useQuery } from '@tanstack/react-query'
import { executeSearch } from '../../api/searches'
import { formatDay, toIsoDate } from './timelineUtils'
import PhotoThumbnail from '../browse/PhotoThumbnail'
import type { SearchCriterion } from '../../types/api'

interface Props {
  logic: 'AND' | 'OR'
  criteria: SearchCriterion[]
  year: number
  month: number
  day: number
  onBack: () => void
}

export default function TimelineDayView({ logic, criteria, year, month, day, onBack }: Props) {
  const dateStr = toIsoDate(year, month, day)

  const { data: photos = [], isLoading } = useQuery({
    queryKey: ['search-day-photos', { logic, criteria, date: dateStr }],
    queryFn: () =>
      executeSearch({
        logic,
        criteria,
        sort: 'taken_at_desc',
        limit: 500,
        offset: 0,
        date_filter: dateStr,
      }),
  })

  const orderedHashes = photos.map(p => p.hothash)

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-800">
        <button
          onClick={onBack}
          className="text-sm text-gray-400 hover:text-white transition-colors shrink-0"
        >
          ← Tidslinje
        </button>
        <h2 className="text-lg font-semibold text-white">
          {formatDay(day, month, year)}
        </h2>
        {!isLoading && (
          <span className="text-sm text-gray-400">{photos.length} bilder</span>
        )}
      </div>

      {isLoading && (
        <div className="py-12 text-center text-gray-400">Laster bilder…</div>
      )}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-1 select-none">
        {photos.map(photo => (
          <PhotoThumbnail key={photo.hothash} photo={photo} orderedHashes={orderedHashes} />
        ))}
      </div>
    </div>
  )
}
