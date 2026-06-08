interface Props {
  value: number | null
  onChange: (v: unknown) => void
}

function parseAperture(raw: string): number | null {
  const s = raw.trim().replace(/^f\//i, '').replace(/^f/i, '')
  const n = parseFloat(s)
  return isNaN(n) ? null : n
}

export default function ApertureInput({ value, onChange }: Props) {
  const display = value != null ? `f/${value}` : ''
  return (
    <input
      type="text"
      placeholder="f/2.8"
      className="rounded bg-gray-700 px-2 py-1.5 text-sm text-white w-20"
      defaultValue={display}
      onBlur={e => {
        const parsed = parseAperture(e.target.value)
        if (parsed !== null) onChange(parsed)
      }}
    />
  )
}
