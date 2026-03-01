export interface OperatorDef {
  operator: string
  label: string
}

export interface FieldDef {
  field: string
  label: string
  operators: OperatorDef[]
}

export const SEARCH_FIELDS: FieldDef[] = [
  {
    field: 'rating',
    label: 'Vurdering',
    operators: [
      { operator: 'gte', label: '>=' },
      { operator: 'lte', label: '<=' },
      { operator: 'eq', label: '=' },
      { operator: 'is_null', label: 'Ikke satt' },
    ],
  },
  {
    field: 'taken_at',
    label: 'Tatt (dato)',
    operators: [
      { operator: 'after', label: 'Etter' },
      { operator: 'before', label: 'Før' },
      { operator: 'between', label: 'Mellom' },
    ],
  },
  {
    field: 'tags',
    label: 'Tags',
    operators: [
      { operator: 'any_of', label: 'En av' },
      { operator: 'all_of', label: 'Alle av' },
      { operator: 'none_of', label: 'Ingen av' },
    ],
  },
  {
    field: 'photographer_id',
    label: 'Fotograf',
    operators: [
      { operator: 'eq', label: 'Er' },
      { operator: 'neq', label: 'Er ikke' },
    ],
  },
  {
    field: 'event_id',
    label: 'Event',
    operators: [
      { operator: 'eq', label: 'Er' },
      { operator: 'neq', label: 'Er ikke' },
      { operator: 'is_null', label: 'Ikke satt' },
    ],
  },
  {
    field: 'camera_make',
    label: 'Kamerafabrikat',
    operators: [
      { operator: 'eq', label: 'Er' },
      { operator: 'contains', label: 'Inneholder' },
    ],
  },
  {
    field: 'camera_model',
    label: 'Kameramodell',
    operators: [
      { operator: 'eq', label: 'Er' },
      { operator: 'contains', label: 'Inneholder' },
    ],
  },
]
