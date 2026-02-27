import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { CollectionItem } from '../../types/api'
import useCollectionViewStore from '../../stores/useCollectionViewStore'
import ThumbnailShell from '../../components/ui/ThumbnailShell'
import TextCard from './TextCard'

interface Props {
  item: CollectionItem
  isCursorBefore: boolean
  isPreviewBefore: boolean
  onCursorZoneEnter: () => void
  onCursorZoneLeave: () => void
  onCursorZoneClick: () => void
}

export default function CollectionItemCell({
  item,
  isCursorBefore, isPreviewBefore,
  onCursorZoneEnter, onCursorZoneLeave, onCursorZoneClick,
}: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id })

  const setInsertionPoint = useCollectionViewStore(s => s.setInsertionPoint)

  const style = { transform: CSS.Transform.toString(transform), transition }

  if (isDragging) {
    return (
      <div ref={setNodeRef} style={style} className="relative w-[150px] h-[150px] rounded-sm overflow-hidden">
        {item.hotpreview_b64 && (
          <img
            src={`data:image/jpeg;base64,${item.hotpreview_b64}`}
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-20"
          />
        )}
        <div className="absolute inset-0 border-2 border-dashed border-blue-400/60 rounded-sm" />
      </div>
    )
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
        ? <TextCard item={item} />
        : <ThumbnailShell
            imageData={item.hotpreview_b64 ?? ''}
            isSelected={false}
            onClick={() => setInsertionPoint(null)}
            onDoubleClick={() => {}}
            onContextMenu={e => e.preventDefault()}
            bottomOverlay={item.caption ?? undefined}
          />
      }
    </div>
  )
}
