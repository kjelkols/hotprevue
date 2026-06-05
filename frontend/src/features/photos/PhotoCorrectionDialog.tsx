import { useQuery } from '@tanstack/react-query'
import * as Dialog from '@radix-ui/react-dialog'
import { getPhoto } from '../../api/photos'
import { getBaseUrl } from '../../api/client'
import CorrectionPanel from './CorrectionPanel'

interface Props {
  hothash: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function PhotoCorrectionDialog({ hothash, open, onOpenChange }: Props) {
  const { data: photo } = useQuery({
    queryKey: ['photo', hothash],
    queryFn: () => getPhoto(hothash),
    enabled: open,
  })

  const cacheKey = photo?.correction?.updated_at ? +new Date(photo.correction.updated_at) : 0
  const previewUrl = `${getBaseUrl()}/photos/${hothash}/coldpreview${cacheKey ? `?t=${cacheKey}` : ''}`

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/70 z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm bg-gray-900 rounded-xl border border-gray-700 p-5 shadow-2xl outline-none">
          <Dialog.Title className="text-sm font-semibold text-gray-300 mb-3">Korriger bilde</Dialog.Title>
          <div className="flex justify-center mb-4 rounded-lg bg-gray-950 p-2 min-h-[10rem]">
            <img key={cacheKey} src={previewUrl} alt="" className="max-h-44 rounded object-contain" />
          </div>
          {photo
            ? <CorrectionPanel photo={photo} mode="compact" />
            : <p className="text-sm text-gray-500 text-center py-4">Laster…</p>
          }
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
