import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { CollectionItem } from '../../types/api'
import useCollectionViewStore from '../../stores/useCollectionViewStore'
import ThumbnailShell from '../../components/ui/ThumbnailShell'
import TextCard from './TextCard'

interface Props {
  item: CollectionItem
  orderedIds: string[]
}

export default function CollectionItemCell({ item, orderedIds }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id })

  const selectOnly = useCollectionViewStore(s => s.selectOnly)
  const toggleOne = useCollectionViewStore(s => s.toggleOne)
  const selectRange = useCollectionViewStore(s => s.selectRange)
  const isSelected = useCollectionViewStore(s => s.selected.has(item.id))

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  if (item.card_type !== null) {
    return (
      <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
        <TextCard item={item} orderedIds={orderedIds} />
      </div>
    )
  }

  function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    if (e.shiftKey) selectRange(item.id, orderedIds)
    else if (e.ctrlKey || e.metaKey) toggleOne(item.id)
    else selectOnly(item.id)
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <ThumbnailShell
        imageData={item.hotpreview_b64 ?? ''}
        isSelected={isSelected}
        onClick={handleClick}
        onDoubleClick={() => {}}
        onContextMenu={(e) => e.preventDefault()}
        bottomOverlay={item.caption ?? undefined}
      />
    </div>
  )
}
