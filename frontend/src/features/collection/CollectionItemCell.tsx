import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { CollectionItem } from '../../types/api'
import ThumbnailShell from '../../components/ui/ThumbnailShell'
import TextCard from './TextCard'

interface Props {
  item: CollectionItem
}

export default function CollectionItemCell({ item }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id })

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

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {item.text_item_id !== null
        ? <TextCard item={item} />
        : <ThumbnailShell
            imageData={item.hotpreview_b64 ?? ''}
            isSelected={false}
            onClick={() => {}}
            onDoubleClick={() => {}}
            onContextMenu={e => e.preventDefault()}
            bottomOverlay={item.caption ?? undefined}
          />
      }
    </div>
  )
}
