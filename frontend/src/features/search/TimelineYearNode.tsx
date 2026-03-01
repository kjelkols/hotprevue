import { useState } from 'react'
import TimelineMonthNode from './TimelineMonthNode'
import type { TimelineYear } from '../../types/api'

interface Props {
  node: TimelineYear
  onDayClick: (year: number, month: number, day: number) => void
}

export default function TimelineYearNode({ node, onDayClick }: Props) {
  const [expanded, setExpanded] = useState(true)

  return (
    <div>
      <button
        onClick={() => setExpanded(e => !e)}
        className="flex items-center gap-3 w-full text-left py-2 px-2 rounded-lg hover:bg-gray-800/60 transition-colors"
      >
        <span className="text-gray-500 text-xs w-4 shrink-0 text-center">
          {expanded ? '▼' : '▶'}
        </span>
        <img
          src={`data:image/jpeg;base64,${node.cover_hotpreview_b64}`}
          className="w-14 h-14 object-cover rounded shrink-0"
          alt=""
        />
        <span className="text-2xl font-bold text-white">{node.year}</span>
        <span className="ml-auto text-sm text-gray-400 shrink-0">
          {node.count} bilder
        </span>
      </button>

      {expanded && (
        <div className="ml-7 border-l border-gray-800 pl-3 mt-0.5 space-y-0.5">
          {node.months.map(month => (
            <TimelineMonthNode
              key={month.month}
              node={month}
              year={node.year}
              onDayClick={onDayClick}
            />
          ))}
        </div>
      )}
    </div>
  )
}
