import type { NamingOptions } from './registrationTypes'
import { NAMING_OPTION_LABELS } from './registrationTypes'

interface Props {
  options: NamingOptions
  onChange: (options: NamingOptions) => void
}

export default function NamingOptionsPanel({ options, onChange }: Props) {
  return (
    <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5">
      {NAMING_OPTION_LABELS.map(({ key, label }) => (
        <label key={key} className="flex cursor-pointer select-none items-center gap-1.5 text-xs text-gray-400">
          <input
            type="checkbox"
            checked={options[key]}
            onChange={e => onChange({ ...options, [key]: e.target.checked })}
            className="accent-blue-500"
          />
          {label}
        </label>
      ))}
    </div>
  )
}
