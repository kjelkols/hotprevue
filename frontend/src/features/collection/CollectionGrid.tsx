import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, sortableKeyboardCoordinates,
  rectSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { getCollectionItems, reorderCollectionItems } from '../../api/collections'
import useCollectionViewStore from '../../stores/useCollectionViewStore'
import CollectionItemCell from './CollectionItemCell'
import InsertionPoint from './InsertionPoint'

interface Props {
  collectionId: string
}

export default function CollectionGrid({ collectionId }: Props) {
  const queryClient = useQueryClient()
  const insertionIndex = useCollectionViewStore(s => s.insertionIndex)

  const { data: items = [], isLoading, isError } = useQuery({
    queryKey: ['collection-items', collectionId],
    queryFn: () => getCollectionItems(collectionId),
  })

  const reorderMutation = useMutation({
    mutationFn: (itemIds: string[]) => reorderCollectionItems(collectionId, itemIds),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['collection-items', collectionId] }),
  })

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const orderedIds = items.map(i => i.id)

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = orderedIds.indexOf(active.id as string)
    const newIndex = orderedIds.indexOf(over.id as string)
    const newOrder = arrayMove(orderedIds, oldIndex, newIndex)
    reorderMutation.mutate(newOrder)
  }

  if (isLoading) {
    return <div className="flex items-center justify-center py-20 text-gray-400">Laster…</div>
  }

  if (isError) {
    return <div className="flex items-center justify-center py-20 text-red-400">Kunne ikke hente elementer.</div>
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={orderedIds} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-1">
          {items.map((item, index) => (
            <div key={item.id}>
              {insertionIndex === index && <InsertionPoint index={index} />}
              <CollectionItemCell item={item} orderedIds={orderedIds} />
            </div>
          ))}
          {/* InsertionPoint after last item */}
          <InsertionPoint index={items.length} />
        </div>
      </SortableContext>
    </DndContext>
  )
}
