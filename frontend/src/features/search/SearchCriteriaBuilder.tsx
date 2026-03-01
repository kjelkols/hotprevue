import { SEARCH_FIELDS } from './searchFields'
import type { SearchCriterion } from '../../types/api'
import SearchCriterionRow from './SearchCriterionRow'

interface Props {
  logic: 'AND' | 'OR'
  criteria: SearchCriterion[]
  onLogicChange: (l: 'AND' | 'OR') => void
  onCriteriaChange: (c: SearchCriterion[]) => void
}

export default function SearchCriteriaBuilder({ logic, criteria, onLogicChange, onCriteriaChange }: Props) {
  function addCriterion() {
    const first = SEARCH_FIELDS[0]
    onCriteriaChange([...criteria, { field: first.field, operator: first.operators[0].operator }])
  }

  function updateCriterion(index: number, c: SearchCriterion) {
    const next = [...criteria]
    next[index] = c
    onCriteriaChange(next)
  }

  function removeCriterion(index: number) {
    onCriteriaChange(criteria.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-3 p-4 rounded-xl bg-gray-900 border border-gray-800">
      {criteria.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Kobling:</span>
          {(['AND', 'OR'] as const).map(l => (
            <button
              key={l}
              onClick={() => onLogicChange(l)}
              className={`rounded px-3 py-1 text-xs transition-colors ${
                logic === l
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {l === 'AND' ? 'Alle (AND)' : 'En av (OR)'}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {criteria.map((c, i) => (
          <SearchCriterionRow
            key={i}
            criterion={c}
            onChange={updated => updateCriterion(i, updated)}
            onRemove={() => removeCriterion(i)}
          />
        ))}
      </div>

      {criteria.length === 0 && (
        <p className="text-sm text-gray-600">Ingen kriterier – søket returnerer alle bilder.</p>
      )}

      <button
        onClick={addCriterion}
        className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
      >
        + Legg til kriterium
      </button>
    </div>
  )
}
