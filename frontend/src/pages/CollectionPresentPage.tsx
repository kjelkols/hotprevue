import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getCollection, getCollectionItems } from '../api/collections'
import type { CollectionItem } from '../types/api'
import type { Slide } from '../types/presentation'
import SlidePresenter from '../features/present/SlidePresenter'

function toSlides(items: CollectionItem[]): Slide[] {
  return [...items]
    .sort((a, b) => a.position - b.position)
    .map(item =>
      item.hothash
        ? { kind: 'photo', hothash: item.hothash, caption: item.caption, notes: item.notes, collection_item_id: item.id }
        : { kind: 'text', markup: item.markup ?? '', notes: item.notes, collection_item_id: item.id }
    )
}

export default function CollectionPresentPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: collection, isLoading: loadingCollection } = useQuery({
    queryKey: ['collection', id],
    queryFn: () => getCollection(id!),
    enabled: !!id,
  })

  const { data: items = [], isLoading: loadingItems } = useQuery({
    queryKey: ['collection-items', id],
    queryFn: () => getCollectionItems(id!),
    enabled: !!id,
  })

  if (loadingCollection || loadingItems) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center text-gray-400">
        Laster…
      </div>
    )
  }

  return (
    <SlidePresenter
      slides={toSlides(items)}
      collectionName={collection?.name ?? ''}
      onClose={() => navigate(`/collections/${id}`)}
    />
  )
}
