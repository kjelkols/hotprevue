interface RadiusValue {
  lat: number
  lng: number
  radius_km: number
}

interface Props {
  value: RadiusValue | null
  onChange: (v: unknown) => void
}

const inp = 'rounded bg-gray-700 px-2 py-1.5 text-sm text-white w-24'

export default function LocationRadiusInput({ value, onChange }: Props) {
  const v = value ?? { lat: 0, lng: 0, radius_km: 25 }
  const update = (patch: Partial<RadiusValue>) => onChange({ ...v, ...patch })
  return (
    <span className="flex items-center gap-1.5 flex-wrap">
      <input
        type="number" step="any" placeholder="Lat"
        className={inp} value={v.lat}
        onChange={e => update({ lat: e.target.valueAsNumber })}
      />
      <input
        type="number" step="any" placeholder="Lng"
        className={inp} value={v.lng}
        onChange={e => update({ lng: e.target.valueAsNumber })}
      />
      <input
        type="number" min={1} max={500} placeholder="km"
        className="rounded bg-gray-700 px-2 py-1.5 text-sm text-white w-16"
        value={v.radius_km}
        onChange={e => update({ radius_km: e.target.valueAsNumber })}
      />
      <span className="text-gray-400 text-xs">km</span>
    </span>
  )
}
