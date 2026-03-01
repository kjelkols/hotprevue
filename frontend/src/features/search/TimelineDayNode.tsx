import { formatDay } from './timelineUtils'
import type { TimelineDay } from '../../types/api'

interface Props {
  node: TimelineDay
  year: number
  month: number
  onDayClick: (year: number, month: number, day: number) => void
}

export default function TimelineDayNode({ node, year, month, onDayClick }: Props) {
  return (
    <button
      onClick={() => onDayClick(year, month, node.day)}
      className="flex items-center gap-3 w-full text-left py-1.5 px-2 rounded-lg hover:bg-gray-700/60 transition-colors group"
    >
      {/* indent spacer to align with expand arrows above */}
      <span className="w-4 shrink-0" />
      <img
        src={`data:image/jpeg;base64,${node.cover_hotpreview_b64}`}
        className="w-11 h-11 object-cover rounded shrink-0"
        alt=""
      />
      <span className="text-sm text-gray-200 group-hover:text-white transition-colors">
        {formatDay(node.day, month, year)}
      </span>
      <span className="ml-auto text-xs text-gray-500 shrink-0">
        {node.count} bilder
      </span>
      <span className="text-gray-600 group-hover:text-gray-400 transition-colors text-xs shrink-0">
        →
      </span>
    </button>
  )
}
