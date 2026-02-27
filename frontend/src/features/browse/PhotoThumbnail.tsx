import { useNavigate } from 'react-router-dom'
import type { PhotoListItem } from '../../types/api'
import useSelectionStore from '../../stores/useSelectionStore'
import useContextMenuStore from '../../stores/useContextMenuStore'
import ThumbnailShell from '../../components/ui/ThumbnailShell'

function formatDate(taken_at: string | null): string {
  if (!taken_at) return 'Ukjent dato'
  const d = new Date(taken_at)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yy = String(d.getFullYear()).slice(-2)
  return `${dd}.${mm}.${yy}`
}

interface Props {
  photo: PhotoListItem
  orderedHashes: string[]
}

export default function PhotoThumbnail({ photo, orderedHashes }: Props) {
  const navigate = useNavigate()
  const selectOnly = useSelectionStore(s => s.selectOnly)
  const toggleOne = useSelectionStore(s => s.toggleOne)
  const selectRange = useSelectionStore(s => s.selectRange)
  const isSelected = useSelectionStore(s => s.selected.has(photo.hothash))
  const selectedCount = useSelectionStore(s => s.selected.size)
  const openContextMenu = useContextMenuStore(s => s.openContextMenu)

  function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    if (e.shiftKey) selectRange(photo.hothash, orderedHashes)
    else if (e.ctrlKey || e.metaKey) toggleOne(photo.hothash)
    else selectOnly(photo.hothash)
  }

  function handleDoubleClick() {
    navigate(`/photos/${photo.hothash}`)
  }

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault()
    if (isSelected && selectedCount > 1) return
    if (!isSelected) selectOnly(photo.hothash)
    openContextMenu({
      position: { x: e.clientX, y: e.clientY },
      items: [
        {
          id: 'open',
          label: 'Åpne',
          isDefault: true,
          action: () => navigate(`/photos/${photo.hothash}`),
        },
      ],
    })
  }

  return (
    <ThumbnailShell
      imageData={photo.hotpreview_b64}
      isSelected={isSelected}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      bottomOverlay={formatDate(photo.taken_at)}
    />
  )
}
