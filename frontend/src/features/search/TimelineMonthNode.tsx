import { useState } from 'react'
import { formatMonth } from './timelineUtils'
import TimelineDayNode from './TimelineDayNode'
import type { TimelineMonth } from '../../types/api'

interface Props {
  node: TimelineMonth
  year: number
  onDayClick: (year: number, month: number, day: number) => void
}

export default function TimelineMonthNode({ node, year, onDayClick }: Props) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div>
      <button
        onClick={() => setExpanded(e => !e)}
        className="flex items-center gap-3 w-full text-left py-1.5 px-2 rounded-lg hover:bg-gray-800/60 transition-colors"
      >
        <span className="text-gray-500 text-xs w-4 shrink-0 text-center">
          {expanded ? '▼' : '▶'}
        </span>
        <img
          src={`data:image/jpeg;base64,${node.cover_hotpreview_b64}`}
          className="w-10 h-10 object-cover rounded shrink-0"
          alt=""
        />
        <span className="text-sm font-semibold text-gray-100">
          {formatMonth(node.month, year)}
        </span>
        <span className="ml-auto text-xs text-gray-500 shrink-0">
          {node.count} bilder
        </span>
      </button>

      {expanded && (
        <div className="ml-7 border-l border-gray-800 pl-3 mt-0.5 space-y-0.5">
          {node.days.map(day => (
            <TimelineDayNode
              key={day.day}
              node={day}
              year={year}
              month={node.month}
              onDayClick={onDayClick}
            />
          ))}
        </div>
      )}
    </div>
  )
}
