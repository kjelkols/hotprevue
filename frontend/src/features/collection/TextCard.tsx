import type { CollectionItem } from '../../types/api'

interface Props {
  item: CollectionItem
}

export default function TextCard({ item }: Props) {
  return (
    <div className="w-[150px] h-[150px] rounded-sm p-3 overflow-hidden flex flex-col gap-1 bg-gray-800 hover:bg-gray-750 transition-colors">
      {item.markup && (
        <p className="text-[10px] text-gray-400 line-clamp-6 leading-relaxed whitespace-pre-wrap">
          {item.markup}
        </p>
      )}
    </div>
  )
}
