import { useState } from 'react'
import { SEARCH_FIELDS } from './searchFields'
import type { SearchCriterion } from '../../types/api'
import CriterionToggleRow from './CriterionToggleRow'

type RowState = { active: boolean; operator: string; value?: unknown }
type PanelState = Record<string, RowState>

function buildState(criteria: SearchCriterion[] = []): PanelState {
  return Object.fromEntries(
    SEARCH_FIELDS.map(f => {
      const c = criteria.find(x => x.field === f.field)
      return [f.field, c
        ? { active: true, operator: c.operator, value: c.value }
        : { active: false, operator: f.operators[0].operator }
      ]
    })
  )
}

function toActive(state: PanelState): SearchCriterion[] {
  return SEARCH_FIELDS
    .filter(f => state[f.field].active)
    .map(f => ({ field: f.field, operator: state[f.field].operator, value: state[f.field].value }))
    .filter(c => c.operator === 'is_null' || c.value !== undefined)
}

interface Props {
  initialCriteria?: SearchCriterion[]
  logic: 'AND' | 'OR'
  onLogicChange: (l: 'AND' | 'OR') => void
  onChange: (c: SearchCriterion[]) => void
}

export default function CriteriaPanel({ initialCriteria, logic, onLogicChange, onChange }: Props) {
  const [state, setState] = useState<PanelState>(() => buildState(initialCriteria))

  function update(field: string, patch: Partial<RowState>) {
    setState(prev => {
      const next = { ...prev, [field]: { ...prev[field], ...patch } }
      onChange(toActive(next))
      return next
    })
  }

  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-2 px-3 pb-3">
        <span className="text-xs text-gray-400">Kobling:</span>
        {(['AND', 'OR'] as const).map(l => (
          <button
            key={l}
            onClick={() => onLogicChange(l)}
            className={`rounded px-2 py-0.5 text-xs transition-colors ${
              logic === l ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {l === 'AND' ? 'Alle (AND)' : 'En av (OR)'}
          </button>
        ))}
      </div>

      {SEARCH_FIELDS.map(f => (
        <CriterionToggleRow
          key={f.field}
          field={f.field}
          active={state[f.field].active}
          operator={state[f.field].operator}
          value={state[f.field].value}
          onToggle={() => update(f.field, { active: !state[f.field].active })}
          onOperatorChange={op => update(f.field, { operator: op, value: undefined })}
          onValueChange={v => update(f.field, { value: v })}
        />
      ))}
    </div>
  )
}
