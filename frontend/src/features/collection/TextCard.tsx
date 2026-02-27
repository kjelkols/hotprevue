import type { CollectionItem } from '../../types/api'
import useCollectionViewStore from '../../stores/useCollectionViewStore'

interface Props {
  item: CollectionItem
  orderedIds: string[]
}

export default function TextCard({ item, orderedIds }: Props) {
  const selectOnly = useCollectionViewStore(s => s.selectOnly)
  const toggleOne = useCollectionViewStore(s => s.toggleOne)
  const selectRange = useCollectionViewStore(s => s.selectRange)
  const isSelected = useCollectionViewStore(s => s.selected.has(item.id))

  function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    if (e.shiftKey) selectRange(item.id, orderedIds)
    else if (e.ctrlKey || e.metaKey) toggleOne(item.id)
    else selectOnly(item.id)
  }

  return (
    <div
      onClick={handleClick}
      className={[
        'w-[150px] h-[150px] rounded-sm p-3 cursor-pointer overflow-hidden',
        'flex flex-col gap-1 transition-colors',
        'bg-gray-800 hover:bg-gray-750',
        isSelected ? 'ring-2 ring-inset ring-blue-400' : '',
      ].join(' ')}
    >
      {item.title && (
        <p className="text-xs font-semibold text-gray-200 line-clamp-2 shrink-0">
          {item.title}
        </p>
      )}
      {item.text_content && (
        <p className="text-[10px] text-gray-400 line-clamp-5 leading-relaxed">
          {item.text_content}
        </p>
      )}
    </div>
  )
}
