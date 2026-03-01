import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchSearchTimeline } from '../../api/searches'
import TimelineYearNode from './TimelineYearNode'
import TimelineDayView from './TimelineDayView'
import type { SearchCriterion } from '../../types/api'

interface DaySelection {
  year: number
  month: number
  day: number
}

interface Props {
  logic: 'AND' | 'OR'
  criteria: SearchCriterion[]
}

export default function SearchTimeline({ logic, criteria }: Props) {
  const [selectedDay, setSelectedDay] = useState<DaySelection | null>(null)

  const { data: years = [], isLoading, isError } = useQuery({
    queryKey: ['search-timeline', { logic, criteria }],
    queryFn: () => fetchSearchTimeline({ logic, criteria }),
  })

  if (selectedDay) {
    return (
      <TimelineDayView
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
        Ingen bilder med dato i søkeresultatet.
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
