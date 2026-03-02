import { formatDay, toIsoDate } from './timelineUtils'
import PhotoGrid from '../browse/PhotoGrid'
import { usePhotoSource } from '../../hooks/usePhotoSource'
import type { SearchCriterion } from '../../types/api'

interface Props {
  sessionId?: string
  eventId?: string
  tag?: string
  logic?: 'AND' | 'OR'
  criteria?: SearchCriterion[]
  year: number
  month: number
  day: number
  onBack: () => void
}

export default function TimelineDayView({
  sessionId, eventId, tag, logic, criteria,
  year, month, day, onBack,
}: Props) {
  const dateStr = toIsoDate(year, month, day)
  const source = usePhotoSource({ sessionId, eventId, tag, criteria, logic, dateFilter: dateStr })

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
      </div>
      <PhotoGrid {...source} />
    </div>
  )
}
