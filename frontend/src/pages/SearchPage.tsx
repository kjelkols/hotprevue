import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSearch, createSearch, patchSearch } from '../api/searches'
import CriteriaPanel from '../features/search/CriteriaPanel'
import QuickView from '../features/browse/QuickView'
import PhotoTimeline from '../features/browse/PhotoTimeline'
import ViewToggle from '../components/ViewToggle'
import SplitPane from '../components/SplitPane'
import { usePhotoSource } from '../hooks/usePhotoSource'
import type { SearchCriterion } from '../types/api'

type View = 'grid' | 'timeline'

export default function SearchPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [name, setName] = useState('')
  const [logic, setLogic] = useState<'AND' | 'OR'>('AND')
  const [criteria, setCriteria] = useState<SearchCriterion[]>([])
  const [debounced, setDebounced] = useState<{ logic: 'AND' | 'OR'; criteria: SearchCriterion[] }>({ logic: 'AND', criteria: [] })
  const [view, setView] = useState<View>('grid')

  const { data: saved } = useQuery({
    queryKey: ['searches', id],
    queryFn: () => getSearch(id!),
    enabled: !!id,
  })

  useEffect(() => {
    if (saved) {
      setName(saved.name)
      setLogic(saved.logic)
      setCriteria(saved.criteria)
    }
  }, [saved?.id])

  useEffect(() => {
    const t = setTimeout(() => setDebounced({ logic, criteria }), 400)
    return () => clearTimeout(t)
  }, [logic, criteria])

  const photoSource = usePhotoSource({
    logic: debounced.logic,
    criteria: debounced.criteria,
    enabled: debounced.criteria.length > 0,
  })

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

  const isReady = !id || !!saved
  const hasActiveCriteria = debounced.criteria.length > 0

  const leftPanel = (
    <div className="flex h-full flex-col border-r border-gray-800">
      <div className="flex items-center gap-2 border-b border-gray-800 px-3 py-2.5">
        <button
          onClick={() => navigate('/searches')}
          className="text-sm text-gray-300 hover:text-white transition-colors"
        >
          ← Tilbake
        </button>
      </div>
      <div className="flex items-center gap-2 border-b border-gray-800 px-3 py-2">
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Søkenavn…"
          className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none placeholder-gray-600"
        />
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || !name.trim()}
          className="shrink-0 rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
        >
          {saveMutation.isPending ? '…' : 'Lagre'}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto py-3">
        {isReady && (
          <CriteriaPanel
            key={id ?? 'new'}
            initialCriteria={saved?.criteria}
            logic={logic}
            onLogicChange={setLogic}
            onChange={setCriteria}
          />
        )}
      </div>
    </div>
  )

  const rightPanel = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-gray-800 px-4 py-3">
        <span className="text-sm text-gray-300">
          {photoSource.isLoading ? 'Søker…' : hasActiveCriteria ? `${photoSource.photos.length} bilder` : ''}
        </span>
        <div className="ml-auto">
          <ViewToggle view={view} onChange={setView} />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {!hasActiveCriteria ? (
          <div className="flex items-center justify-center py-20 text-sm text-gray-500">
            Aktiver ett eller flere kriterier for å søke
          </div>
        ) : view === 'grid' ? (
          <QuickView
            photos={photoSource.photos}
            isLoading={photoSource.isLoading}
            hasMore={photoSource.hasMore}
            onLoadMore={photoSource.loadMore}
          />
        ) : (
          <PhotoTimeline
            key={JSON.stringify(debounced)}
            logic={debounced.logic}
            criteria={debounced.criteria}
          />
        )}
      </div>
    </div>
  )

  return (
    <div className="h-full bg-gray-950 text-white">
      <SplitPane left={leftPanel} right={rightPanel} defaultSize={300} minSize={200} maxSize={550} storageKey="search" />
    </div>
  )
}
