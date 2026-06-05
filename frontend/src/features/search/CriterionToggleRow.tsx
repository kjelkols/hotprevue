import { SEARCH_FIELDS } from './searchFields'
import SearchValueInput from './SearchValueInput'

interface Props {
  field: string
  active: boolean
  operator: string
  value: unknown
  onToggle: () => void
  onOperatorChange: (op: string) => void
  onValueChange: (v: unknown) => void
}

export default function CriterionToggleRow({
  field, active, operator, value, onToggle, onOperatorChange, onValueChange,
}: Props) {
  const fieldDef = SEARCH_FIELDS.find(f => f.field === field)!

  return (
    <div className={`border-l-2 px-3 py-2 transition-colors ${
      active
        ? 'border-blue-500 bg-gray-800/50'
        : 'border-transparent hover:bg-gray-900/60'
    }`}>
      <button onClick={onToggle} className="flex w-full items-center gap-2 text-left">
        <span className={`text-xs leading-none ${active ? 'text-blue-400' : 'text-gray-600'}`}>
          {active ? '●' : '○'}
        </span>
        <span className={`text-sm font-medium ${active ? 'text-white' : 'text-gray-500'}`}>
          {fieldDef.label}
        </span>
      </button>

      {active && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-4">
          <select
            value={operator}
            onChange={e => onOperatorChange(e.target.value)}
            className="rounded bg-gray-700 px-2 py-1 text-xs text-white outline-none"
          >
            {fieldDef.operators.map(o => (
              <option key={o.operator} value={o.operator}>{o.label}</option>
            ))}
          </select>
          <SearchValueInput
            field={field}
            operator={operator}
            value={value}
            onChange={onValueChange}
          />
        </div>
      )}
    </div>
  )
}
