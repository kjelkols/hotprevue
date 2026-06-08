import { useQuery } from '@tanstack/react-query'
import { listPhotographers } from '../../api/photographers'
import { listEvents } from '../../api/events'
import TagMultiSelect from './TagMultiSelect'
import ApertureInput from './ApertureInput'
import LocationRadiusInput from './LocationRadiusInput'
import { TIME_SOURCE_LABELS, ACCURACY_LABELS } from '../../lib/timeSource'
import { LOCATION_SOURCE_LABELS } from '../../lib/locationSource'

interface Props {
  field: string
  operator: string
  value: unknown
  onChange: (v: unknown) => void
}

const cls = 'rounded bg-gray-700 px-2 py-1.5 text-sm text-white'

function NumericInput({ value, onChange }: { value: unknown; onChange: (v: unknown) => void }) {
  return (
    <input
      type="number" step="any"
      className={`${cls} w-24`}
      value={(value as number) ?? ''}
      onChange={e => onChange(e.target.valueAsNumber)}
    />
  )
}

function NumericBetween({ value, onChange }: { value: unknown; onChange: (v: unknown) => void }) {
  const arr = Array.isArray(value) ? (value as number[]) : [null, null]
  return (
    <span className="flex items-center gap-1">
      <input type="number" step="any" className={`${cls} w-20`} value={arr[0] ?? ''} onChange={e => onChange([e.target.valueAsNumber, arr[1] ?? null])} />
      <span className="text-gray-400 text-sm">–</span>
      <input type="number" step="any" className={`${cls} w-20`} value={arr[1] ?? ''} onChange={e => onChange([arr[0] ?? null, e.target.valueAsNumber])} />
    </span>
  )
}

export default function SearchValueInput({ field, operator, value, onChange }: Props) {
  const { data: photographers = [] } = useQuery({
    queryKey: ['photographers'], queryFn: listPhotographers, enabled: field === 'photographer_id',
  })
  const { data: events = [] } = useQuery({
    queryKey: ['events'], queryFn: listEvents, enabled: field === 'event_id',
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
    return <input type="date" className={cls} value={(value as string) ?? ''} onChange={e => onChange(e.target.value)} />
  }

  if (field === 'rating') return <NumericInput value={value} onChange={onChange} />

  if (field === 'photographer_id') {
    return (
      <select className={cls} value={(value as string) ?? ''} onChange={e => onChange(e.target.value)}>
        <option value="">– Velg –</option>
        {photographers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
    )
  }

  if (field === 'tags') {
    return <TagMultiSelect value={Array.isArray(value) ? (value as string[]) : []} onChange={onChange} />
  }

  if (field === 'event_id') {
    return (
      <select className={cls} value={(value as string) ?? ''} onChange={e => onChange(e.target.value)}>
        <option value="">– Velg –</option>
        {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
      </select>
    )
  }

  if (field === 'iso' || field === 'focal_length') {
    return operator === 'between' ? <NumericBetween value={value} onChange={onChange} /> : <NumericInput value={value} onChange={onChange} />
  }

  if (field === 'aperture') {
    return operator === 'between'
      ? <NumericBetween value={value} onChange={onChange} />
      : <ApertureInput value={value as number | null} onChange={onChange} />
  }

  if (field === 'orientation') {
    return (
      <select className={cls} value={(value as string) ?? ''} onChange={e => onChange(e.target.value)}>
        <option value="">– Velg –</option>
        <option value="portrait">Portrett</option>
        <option value="landscape">Landskap</option>
        <option value="square">Kvadrat</option>
      </select>
    )
  }

  if (field === 'has_location') {
    return (
      <select className={cls} value={String(value ?? '')} onChange={e => onChange(e.target.value === 'true')}>
        <option value="">– Velg –</option>
        <option value="true">Har GPS</option>
        <option value="false">Mangler GPS</option>
      </select>
    )
  }

  if (field === 'location_radius') {
    return <LocationRadiusInput value={value as Record<string, number> | null} onChange={onChange} />
  }

  if (field === 'taken_at_source') {
    return (
      <select className={cls} value={(value as number) ?? ''} onChange={e => onChange(Number(e.target.value))}>
        <option value="">– Velg –</option>
        {Object.entries(TIME_SOURCE_LABELS).map(([k, label]) => (
          <option key={k} value={k}>{label}</option>
        ))}
      </select>
    )
  }

  if (field === 'taken_at_accuracy') {
    return (
      <select className={cls} value={(value as string) ?? ''} onChange={e => onChange(e.target.value)}>
        <option value="">– Velg –</option>
        {Object.entries(ACCURACY_LABELS).map(([k, label]) => (
          <option key={k} value={k}>{label}</option>
        ))}
      </select>
    )
  }

  if (field === 'location_source') {
    return (
      <select className={cls} value={(value as number) ?? ''} onChange={e => onChange(Number(e.target.value))}>
        <option value="">– Velg –</option>
        {Object.entries(LOCATION_SOURCE_LABELS).map(([k, label]) => (
          <option key={k} value={k}>{label}</option>
        ))}
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
