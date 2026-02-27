import type { CollectionItem } from '../../types/api'

function parseMarkup(markup: string): { title: string | null; body: string | null } {
  const trimmed = markup.trim()
  if (trimmed.startsWith('# ')) {
    const nlIndex = trimmed.indexOf('\n')
    if (nlIndex === -1) return { title: trimmed.slice(2).trim() || null, body: null }
    const title = trimmed.slice(2, nlIndex).trim() || null
    const body = trimmed.slice(nlIndex).trim() || null
    return { title, body }
  }
  return { title: null, body: trimmed || null }
}

interface Props {
  item: CollectionItem
}

export default function TextCard({ item }: Props) {
  const { title, body } = parseMarkup(item.markup ?? '')

  return (
    <div className="w-[150px] h-[150px] rounded-sm bg-gray-800 p-3 flex flex-col items-center justify-center text-center gap-1.5">
      {title && (
        <p className="text-[11px] font-semibold text-gray-100 line-clamp-3 leading-snug">{title}</p>
      )}
      {body && (
        <p className="text-[10px] text-gray-400 line-clamp-5 leading-relaxed">{body}</p>
      )}
      {!title && !body && (
        <p className="text-[10px] text-gray-600 italic">Tomt tekstkort</p>
      )}
    </div>
  )
}
