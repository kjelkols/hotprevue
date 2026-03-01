import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSearch, createSearch, patchSearch } from '../api/searches'
import SearchCriteriaBuilder from '../features/search/SearchCriteriaBuilder'
import SearchResultGrid from '../features/search/SearchResultGrid'
import useNavigationStore from '../stores/useNavigationStore'
import type { SearchCriterion } from '../types/api'

type Applied = { logic: 'AND' | 'OR'; criteria: SearchCriterion[] } | null

export default function SearchPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const addSource = useNavigationStore(s => s.addSource)
  const sources = useNavigationStore(s => s.sources)

  const [name, setName] = useState('')
  const [logic, setLogic] = useState<'AND' | 'OR'>('AND')
  const [criteria, setCriteria] = useState<SearchCriterion[]>([])
  const [applied, setApplied] = useState<Applied>(null)
  const [seeded, setSeeded] = useState(false)

  const { data: saved } = useQuery({
    queryKey: ['searches', id],
    queryFn: () => getSearch(id!),
    enabled: !!id,
  })

  useEffect(() => {
    if (saved && !seeded) {
      setName(saved.name)
      setLogic(saved.logic)
      setCriteria(saved.criteria)
      setApplied({ logic: saved.logic, criteria: saved.criteria })
      setSeeded(true)
    }
  }, [saved, seeded])

  const saveMutation = useMutation({
    mutationFn: () =>
      id
        ? patchSearch(id, { name, logic, criteria })
        : createSearch({ name, logic, criteria }),
    onSuccess: result => {
      qc.invalidateQueries({ queryKey: ['searches'] })
      if (!id) navigate(`/searches/${result.id}`, { replace: true })
    },
  })

  const isSource = !!id && sources.some(s => s.id === id)

  function handleSetSource() {
    if (!id) return
    addSource({ id, type: 'search', label: name || 'Søk', url: `/searches/${id}` })
  }

  return (
    <div className="min-h-full bg-gray-950 text-white">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800">
        <button
          onClick={() => navigate('/searches')}
          className="text-sm text-gray-400 hover:text-white transition-colors shrink-0"
        >
          ← Tilbake
        </button>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Søkenavn…"
          className="flex-1 bg-transparent text-xl font-semibold outline-none placeholder-gray-600 min-w-0"
        />
        {id && (
          <button
            onClick={handleSetSource}
            className={`rounded-lg px-3 py-1.5 text-sm transition-colors shrink-0 ${
              isSource
                ? 'bg-gray-600 text-white hover:bg-gray-500'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            {isSource ? 'Kilde ✓' : 'Sett som kilde'}
          </button>
        )}
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || !name.trim()}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-500 disabled:opacity-50 transition-colors shrink-0"
        >
          {saveMutation.isPending ? 'Lagrer…' : id ? 'Lagre endringer' : 'Lagre søk'}
        </button>
      </div>

      <div className="p-4 space-y-4 max-w-3xl">
        <SearchCriteriaBuilder
          logic={logic}
          criteria={criteria}
          onLogicChange={setLogic}
          onCriteriaChange={setCriteria}
        />
        <button
          onClick={() => setApplied({ logic, criteria })}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-500 transition-colors"
        >
          Kjør søk
        </button>
      </div>

      {applied && (
        <div className="p-4">
          <SearchResultGrid logic={applied.logic} criteria={applied.criteria} />
        </div>
      )}
    </div>
  )
}
