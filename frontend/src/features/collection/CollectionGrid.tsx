import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, rectSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { getCollectionItems, reorderCollectionItems } from '../../api/collections'
import useCollectionViewStore from '../../stores/useCollectionViewStore'
import CollectionItemCell from './CollectionItemCell'
import InsertionPoint from './InsertionPoint'
import CursorEndIndicator from './CursorEndIndicator'

interface Props {
  collectionId: string
}

export default function CollectionGrid({ collectionId }: Props) {
  const queryClient = useQueryClient()
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const insertionIndex = useCollectionViewStore(s => s.insertionIndex)
  const setInsertionPoint = useCollectionViewStore(s => s.setInsertionPoint)
  const setActiveCollectionId = useCollectionViewStore(s => s.setActiveCollectionId)

  const { data: items = [], isLoading, isError } = useQuery({
    queryKey: ['collection-items', collectionId],
    queryFn: () => getCollectionItems(collectionId),
  })

  // Register as active collection and reset cursor on mount/switch
  useEffect(() => {
    setActiveCollectionId(collectionId)
    setInsertionPoint(null)
    return () => setActiveCollectionId(null)
  }, [collectionId, setActiveCollectionId, setInsertionPoint])

  const resolvedIndex = insertionIndex ?? items.length

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      setInsertionPoint(Math.max(0, resolvedIndex - 1))
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      setInsertionPoint(Math.min(items.length, resolvedIndex + 1))
    }
  }, [resolvedIndex, items.length, setInsertionPoint])

  const reorderMutation = useMutation({
    mutationFn: (itemIds: string[]) => reorderCollectionItems(collectionId, itemIds),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['collection-items', collectionId] }),
  })

  const sensors = useSensors(
    useSensor(PointerSensor),
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
        <div
          className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-1 outline-none"
          tabIndex={0}
          onKeyDown={handleKeyDown}
        >
          {items.length === 0 && <InsertionPoint />}
          {items.map((item, index) => (
            <CollectionItemCell
              key={item.id}
              item={item}
              orderedIds={orderedIds}
              isCursorBefore={resolvedIndex === index}
              isPreviewBefore={hoveredIndex === index}
              onCursorZoneEnter={() => setHoveredIndex(index)}
              onCursorZoneLeave={() => setHoveredIndex(null)}
              onCursorZoneClick={() => setInsertionPoint(index)}
            />
          ))}
          {items.length > 0 && (
            <CursorEndIndicator
              isActive={resolvedIndex === items.length}
              isPreview={hoveredIndex === items.length}
              onMouseEnter={() => setHoveredIndex(items.length)}
              onMouseLeave={() => setHoveredIndex(null)}
              onClick={() => setInsertionPoint(items.length)}
            />
          )}
        </div>
      </SortableContext>
    </DndContext>
  )
}
