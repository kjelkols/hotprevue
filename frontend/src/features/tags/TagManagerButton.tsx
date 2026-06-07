import { useQuery } from '@tanstack/react-query'
import { listTags } from '../../api/tags'
import useTagSetStore from '../../stores/useTagSetStore'
import TagSetPopover from './TagSetPopover'

export default function TagManagerButton() {
  const { tagIds } = useTagSetStore()
  const { data: tags = [] } = useQuery({ queryKey: ['tags'], queryFn: listTags })

  const activeNames = tags.filter(t => tagIds.has(t.id)).map(t => t.name)
  const label = activeNames.length === 0
    ? 'Tag-sett'
    : activeNames.length <= 2
      ? activeNames.join(', ')
      : `${activeNames.slice(0, 2).join(', ')} +${activeNames.length - 2}`

  return (
    <TagSetPopover>
      <button
        title={activeNames.length > 0 ? activeNames.join(', ') : 'Velg tags å jobbe med'}
        className={
          'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors shrink-0 ' +
          (tagIds.size > 0
            ? 'bg-blue-900/50 text-blue-200 border border-blue-700 hover:bg-blue-900'
            : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700')
        }
      >
        <span>⊞</span>
        <span>{label}</span>
        {tagIds.size > 0 && (
          <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-medium">
            {tagIds.size}
          </span>
        )}
      </button>
    </TagSetPopover>
  )
}
