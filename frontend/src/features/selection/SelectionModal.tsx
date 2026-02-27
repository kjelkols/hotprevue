import * as Dialog from '@radix-ui/react-dialog'
import { useQuery } from '@tanstack/react-query'
import useSelectionStore from '../../stores/useSelectionStore'
import { listPhotos } from '../../api/photos'
import SelectionThumbnail from './SelectionThumbnail'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function SelectionModal({ open, onOpenChange }: Props) {
  const selected = useSelectionStore(s => s.selected)
  const toggleOne = useSelectionStore(s => s.toggleOne)
  const hothashes = Array.from(selected)

  const { data: photos = [] } = useQuery({
    queryKey: ['selection-photos', hothashes],
    queryFn: () => listPhotos({ hothashes }),
    enabled: open && hothashes.length > 0,
  })

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[min(90vw,720px)] max-h-[80vh] flex flex-col bg-gray-900 rounded-xl shadow-2xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
            <Dialog.Title className="text-white font-semibold">
              {selected.size} {selected.size === 1 ? 'bilde' : 'bilder'} valgt
            </Dialog.Title>
            <Dialog.Close className="text-gray-400 hover:text-white transition-colors text-xl leading-none">
              ✕
            </Dialog.Close>
          </div>

          <div className="overflow-y-auto p-4 flex-1">
            {hothashes.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">Ingen bilder valgt.</p>
            ) : (
              <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))' }}>
                {photos.map(photo => (
                  <SelectionThumbnail
                    key={photo.hothash}
                    photo={photo}
                    onRemove={toggleOne}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="px-5 py-3 border-t border-gray-700 flex justify-end">
            <Dialog.Close className="rounded-lg bg-gray-700 px-4 py-2 text-sm text-white hover:bg-gray-600 transition-colors">
              Lukk
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
