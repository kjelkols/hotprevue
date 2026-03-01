import { useQuery } from '@tanstack/react-query'
import { listPhotographers } from '../../api/photographers'
import { listEvents } from '../../api/events'

interface Props {
  field: string
  operator: string
  value: unknown
  onChange: (v: unknown) => void
}

const cls = 'rounded bg-gray-700 px-2 py-1.5 text-sm text-white'

export default function SearchValueInput({ field, operator, value, onChange }: Props) {
  const { data: photographers = [] } = useQuery({
    queryKey: ['photographers'],
    queryFn: listPhotographers,
    enabled: field === 'photographer_id',
  })
  const { data: events = [] } = useQuery({
    queryKey: ['events'],
    queryFn: listEvents,
    enabled: field === 'event_id',
  })

  if (operator === 'is_null') return null

  if (field === 'taken_at') {
    if (operator === 'between') {
      const arr = Array.isArray(value) ? (value as string[]) : ['', '']
      return (
        <span className="flex items-center gap-1">
          <input type="date" className={cls} value={arr[0] ?? ''} onChange={e => onChange([e.target.value, arr[1] ?? ''])} />
          <span className="text-gray-400 text-sm">–</span>
          <input type="date" className={cls} value={arr[1] ?? ''} onChange={e => onChange([arr[0] ?? '', e.target.value])} />
        </span>
      )
    }
    return (
      <input type="date" className={cls} value={(value as string) ?? ''} onChange={e => onChange(e.target.value)} />
    )
  }

  if (field === 'rating') {
    return (
      <input
        type="number" min={1} max={5}
        className={`${cls} w-16`}
        value={(value as number) ?? ''}
        onChange={e => onChange(e.target.valueAsNumber)}
      />
    )
  }

  if (field === 'tags') {
    const tagStr = Array.isArray(value) ? (value as string[]).join(', ') : (value as string) ?? ''
    return (
      <input
        type="text"
        className={`${cls} min-w-32`}
        placeholder="tag1, tag2, …"
        value={tagStr}
        onChange={e => onChange(e.target.value.split(',').map(t => t.trim()).filter(Boolean))}
      />
    )
  }

  if (field === 'photographer_id') {
    return (
      <select className={cls} value={(value as string) ?? ''} onChange={e => onChange(e.target.value)}>
        <option value="">– Velg –</option>
        {photographers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
    )
  }

  if (field === 'event_id') {
    return (
      <select className={cls} value={(value as string) ?? ''} onChange={e => onChange(e.target.value)}>
        <option value="">– Velg –</option>
        {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
      </select>
    )
  }

  return (
    <input
      type="text"
      className={`${cls} min-w-32`}
      value={(value as string) ?? ''}
      onChange={e => onChange(e.target.value)}
    />
  )
}
