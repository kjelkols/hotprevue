import { SEARCH_FIELDS } from './searchFields'
import type { SearchCriterion } from '../../types/api'
import SearchValueInput from './SearchValueInput'

interface Props {
  criterion: SearchCriterion
  onChange: (c: SearchCriterion) => void
  onRemove: () => void
}

const selectCls = 'rounded bg-gray-700 px-2 py-1.5 text-sm text-white'

export default function SearchCriterionRow({ criterion, onChange, onRemove }: Props) {
  const fieldDef = SEARCH_FIELDS.find(f => f.field === criterion.field) ?? SEARCH_FIELDS[0]

  function handleFieldChange(field: string) {
    const newFieldDef = SEARCH_FIELDS.find(f => f.field === field) ?? SEARCH_FIELDS[0]
    onChange({ field, operator: newFieldDef.operators[0].operator, value: undefined })
  }

  function handleOperatorChange(operator: string) {
    onChange({ ...criterion, operator, value: undefined })
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <select
        value={criterion.field}
        onChange={e => handleFieldChange(e.target.value)}
        className={selectCls}
      >
        {SEARCH_FIELDS.map(f => (
          <option key={f.field} value={f.field}>{f.label}</option>
        ))}
      </select>

      <select
        value={criterion.operator}
        onChange={e => handleOperatorChange(e.target.value)}
        className={selectCls}
      >
        {fieldDef.operators.map(o => (
          <option key={o.operator} value={o.operator}>{o.label}</option>
        ))}
      </select>

      <SearchValueInput
        field={criterion.field}
        operator={criterion.operator}
        value={criterion.value}
        onChange={v => onChange({ ...criterion, value: v })}
      />

      <button
        onClick={onRemove}
        className="text-gray-500 hover:text-red-400 transition-colors px-1"
        title="Fjern kriterium"
      >
        ✕
      </button>
    </div>
  )
}
