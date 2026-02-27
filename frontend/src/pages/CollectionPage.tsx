import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getCollection, deleteCollection } from '../api/collections'
import { getBaseUrl } from '../api/client'
import CollectionGrid from '../features/collection/CollectionGrid'
import TextCardCreateDialog from '../features/collection/TextCardCreateDialog'

export default function CollectionPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [textCardOpen, setTextCardOpen] = useState(false)

  const { data: collection, isLoading, isError } = useQuery({
    queryKey: ['collection', id],
    queryFn: () => getCollection(id!),
    enabled: !!id,
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteCollection(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] })
      navigate('/collections')
    },
  })

  function handleDelete() {
    if (!collection) return
    if (window.confirm(`Slett kolleksjonen «${collection.name}»?`)) {
      deleteMutation.mutate()
    }
  }

  if (isLoading) return <div className="flex h-screen items-center justify-center bg-gray-950 text-gray-400">Laster…</div>
  if (isError || !collection) return <div className="flex h-screen items-center justify-center bg-gray-950 text-red-400">Kunne ikke hente kollektion.</div>

  return (
    <div className="min-h-full bg-gray-950 text-white">
      <div className="flex items-center gap-4 px-4 py-3 border-b border-gray-800">
        <button onClick={() => navigate('/collections')} className="text-sm text-gray-400 hover:text-white transition-colors">
          ← Tilbake
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold truncate">{collection.name}</h1>
          {collection.description && <p className="text-sm text-gray-400 truncate">{collection.description}</p>}
        </div>
        <span className="text-sm text-gray-500 shrink-0">
          {collection.item_count} element{collection.item_count !== 1 ? 'er' : ''}
        </span>
        <button
          onClick={() => navigate(`/collections/${id}/present`)}
          className="rounded-lg bg-gray-800 px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-700 transition-colors shrink-0"
        >
          Vis ▶
        </button>
        <a
          href={`${getBaseUrl()}/collections/${id}/export`}
          download
          className="rounded-lg bg-gray-800 px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-700 transition-colors shrink-0"
        >
          Eksporter ↓
        </a>
        <button
          onClick={() => setTextCardOpen(true)}
          className="rounded-lg bg-gray-800 px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-700 transition-colors shrink-0"
        >
          + Tekstkort
        </button>
        <button
          onClick={handleDelete}
          className="rounded-lg bg-gray-800 px-3 py-1.5 text-sm text-red-400 hover:bg-gray-700 transition-colors shrink-0"
        >
          Slett
        </button>
      </div>

      <div className="p-4">
        <CollectionGrid collectionId={id!} />
      </div>

      <TextCardCreateDialog
        collectionId={id!}
        open={textCardOpen}
        onOpenChange={setTextCardOpen}
      />
    </div>
  )
}
