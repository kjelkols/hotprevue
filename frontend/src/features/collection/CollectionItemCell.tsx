import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { CollectionItem } from '../../types/api'
import useCollectionViewStore from '../../stores/useCollectionViewStore'
import ThumbnailShell from '../../components/ui/ThumbnailShell'
import TextCard from './TextCard'

interface Props {
  item: CollectionItem
  orderedIds: string[]
  isCursorBefore: boolean
  isPreviewBefore: boolean
  onCursorZoneEnter: () => void
  onCursorZoneLeave: () => void
  onCursorZoneClick: () => void
}

export default function CollectionItemCell({
  item, orderedIds,
  isCursorBefore, isPreviewBefore,
  onCursorZoneEnter, onCursorZoneLeave, onCursorZoneClick,
}: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id })

  const selectOnly = useCollectionViewStore(s => s.selectOnly)
  const toggleOne = useCollectionViewStore(s => s.toggleOne)
  const selectRange = useCollectionViewStore(s => s.selectRange)
  const isSelected = useCollectionViewStore(s => s.selected.has(item.id))

  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }

  function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    if (e.shiftKey) selectRange(item.id, orderedIds)
    else if (e.ctrlKey || e.metaKey) toggleOne(item.id)
    else selectOnly(item.id)
  }

  const showCursorLine = isCursorBefore || isPreviewBefore

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="relative">
      {/* Cursor zone — leftmost 12px, captures mouse for cursor placement */}
      <div
        className="absolute left-0 top-0 w-3 h-full z-10 cursor-col-resize"
        onMouseEnter={onCursorZoneEnter}
        onMouseLeave={onCursorZoneLeave}
        onClick={e => { e.stopPropagation(); onCursorZoneClick() }}
      />
      {/* Cursor line — absolute left edge, no layout impact */}
      {showCursorLine && (
        <div className={[
          'absolute left-0 top-0 w-0.5 h-full z-20 rounded-r pointer-events-none',
          isCursorBefore
            ? 'bg-blue-400 shadow-[0_0_6px_theme(colors.blue.400)]'
            : 'bg-blue-300/40',
        ].join(' ')} />
      )}
      {item.text_item_id !== null
        ? <TextCard item={item} orderedIds={orderedIds} />
        : <ThumbnailShell
            imageData={item.hotpreview_b64 ?? ''}
            isSelected={isSelected}
            onClick={handleClick}
            onDoubleClick={() => {}}
            onContextMenu={e => e.preventDefault()}
            bottomOverlay={item.caption ?? undefined}
          />
      }
    </div>
  )
}
