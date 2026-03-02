import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchTimeline } from '../../api/searches'
import TimelineYearNode from '../search/TimelineYearNode'
import TimelineDayView from '../search/TimelineDayView'
import type { SearchCriterion } from '../../types/api'

interface DaySelection {
  year: number
  month: number
  day: number
}

export interface PhotoTimelineProps {
  sessionId?: string
  eventId?: string
  tag?: string
  logic?: 'AND' | 'OR'
  criteria?: SearchCriterion[]
}

export default function PhotoTimeline({ sessionId, eventId, tag, logic, criteria }: PhotoTimelineProps) {
  const [selectedDay, setSelectedDay] = useState<DaySelection | null>(null)

  const { data: years = [], isLoading, isError } = useQuery({
    queryKey: ['timeline', { sessionId, eventId, tag, logic, criteria }],
    queryFn: () => fetchTimeline({ sessionId, eventId, tag, logic, criteria }),
  })

  if (selectedDay) {
    return (
      <TimelineDayView
        sessionId={sessionId}
        eventId={eventId}
        tag={tag}
        logic={logic}
        criteria={criteria}
        year={selectedDay.year}
        month={selectedDay.month}
        day={selectedDay.day}
        onBack={() => setSelectedDay(null)}
      />
    )
  }

  if (isLoading) {
    return <div className="py-12 text-center text-gray-400">Bygger tidslinje…</div>
  }

  if (isError) {
    return <div className="py-12 text-center text-red-400">Kunne ikke hente tidslinje.</div>
  }

  if (years.length === 0) {
    return (
      <div className="py-12 text-center text-gray-500">
        Ingen bilder med dato i dette utvalget.
      </div>
    )
  }

  return (
    <div className="space-y-1 max-w-2xl">
      {years.map(year => (
        <TimelineYearNode
          key={year.year}
          node={year}
          onDayClick={(y, m, d) => setSelectedDay({ year: y, month: m, day: d })}
        />
      ))}
    </div>
  )
}
