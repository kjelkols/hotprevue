import { useQueryClient, useMutation } from '@tanstack/react-query'
import { createShortcut, deleteShortcut } from '../api/shortcuts'

interface Props {
  path: string
  name: string
  shortcutId?: string
}

export default function PinDirButton({ path, name, shortcutId }: Props) {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: ['shortcuts'] })

  const addMut = useMutation({ mutationFn: () => createShortcut({ name, path }), onSuccess: invalidate })
  const delMut = useMutation({ mutationFn: () => deleteShortcut(shortcutId!), onSuccess: invalidate })

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation()
    if (shortcutId) delMut.mutate()
    else addMut.mutate()
  }

  const pinned = Boolean(shortcutId)
  const pending = addMut.isPending || delMut.isPending

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      title={pinned ? 'Fjern snarvei' : 'Legg til som snarvei'}
      className={`shrink-0 px-1 text-base transition-all focus:outline-none
        ${pinned
          ? 'text-blue-400 hover:text-red-400 opacity-100'
          : 'text-gray-600 hover:text-blue-400 opacity-0 group-hover:opacity-100'
        }`}
    >
      📌
    </button>
  )
}
