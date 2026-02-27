import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, rectSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { getCollectionItems, reorderCollectionItems } from '../../api/collections'
import useCollectionViewStore from '../../stores/useCollectionViewStore'
import CollectionItemCell from './CollectionItemCell'

interface Props {
  collectionId: string
}

export default function CollectionGrid({ collectionId }: Props) {
  const queryClient = useQueryClient()
  const setActiveCollectionId = useCollectionViewStore(s => s.setActiveCollectionId)

  const { data: items = [], isLoading, isError } = useQuery({
    queryKey: ['collection-items', collectionId],
    queryFn: () => getCollectionItems(collectionId),
  })

  useEffect(() => {
    setActiveCollectionId(collectionId)
    return () => setActiveCollectionId(null)
  }, [collectionId, setActiveCollectionId])

  const reorderMutation = useMutation({
    mutationFn: (itemIds: string[]) => reorderCollectionItems(collectionId, itemIds),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['collection-items', collectionId] }),
  })

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const orderedIds = items.map(i => i.id)
    const oldIndex = orderedIds.indexOf(active.id as string)
    const newIndex = orderedIds.indexOf(over.id as string)
    reorderMutation.mutate(arrayMove(orderedIds, oldIndex, newIndex))
  }

  if (isLoading) return <div className="flex items-center justify-center py-20 text-gray-400">Laster…</div>
  if (isError) return <div className="flex items-center justify-center py-20 text-red-400">Kunne ikke hente elementer.</div>

  const orderedIds = items.map(i => i.id)

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={orderedIds} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-1 select-none">
          {items.map((item) => (
            <CollectionItemCell key={item.id} item={item} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
