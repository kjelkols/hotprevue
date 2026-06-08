import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getStack, setStackCover, removePhotoFromStack, deleteStack } from '../../api/stacks'
import { getBaseUrl } from '../../api/client'
import { STACK_KIND_LABELS } from '../../types/api'
import type { CorrectionInput } from '../../lib/photoTransform'
import { computePhotoTransformCSS } from '../../lib/photoTransform'
import type { CSSProperties } from 'react'

interface Props {
  stackId: string
  onClose: () => void
}

export default function StackExpander({ stackId, onClose }: Props) {
  const qc = useQueryClient()
  const { data: stack, isLoading } = useQuery({
    queryKey: ['stack', stackId],
    queryFn: () => getStack(stackId),
  })

  const coverMut = useMutation({
    mutationFn: (hothash: string) => setStackCover(stackId, hothash),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stack', stackId] })
      qc.invalidateQueries({ queryKey: ['photos'] })
      qc.invalidateQueries({ queryKey: ['stacks'] })
    },
  })

  const removeMut = useMutation({
    mutationFn: (hothash: string) => removePhotoFromStack(stackId, hothash),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stack', stackId] })
      qc.invalidateQueries({ queryKey: ['photos'] })
      qc.invalidateQueries({ queryKey: ['stacks'] })
      if (stack && stack.photos.length <= 1) onClose()
    },
  })

  const deleteMut = useMutation({
    mutationFn: () => deleteStack(stackId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['photos'] })
      qc.invalidateQueries({ queryKey: ['stacks'] })
      onClose()
    },
  })

  if (isLoading || !stack) {
    return (
      <div className="col-span-full bg-gray-900 rounded p-4 text-sm text-gray-400">
        Laster stack…
      </div>
    )
  }

  return (
    <div className="col-span-full bg-gray-900 border border-gray-700 rounded-lg p-3 my-1">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-gray-400">
          {STACK_KIND_LABELS[stack.kind]} · {stack.photos.length} bilder
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => deleteMut.mutate()}
            disabled={deleteMut.isPending}
            className="text-xs text-red-500 hover:text-red-400 disabled:opacity-40"
          >
            Slett stack
          </button>
          <button onClick={onClose} className="text-xs text-gray-500 hover:text-gray-300">
            Lukk ×
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        {stack.photos.map(photo => {
          const correction: CorrectionInput = {
            rotation: photo.rotation,
            flip_horizontal: photo.flip_horizontal,
            crop_left: photo.crop_left,
            crop_top: photo.crop_top,
            crop_right: photo.crop_right,
            crop_bottom: photo.crop_bottom,
          }
          const { imgStyle, wrapperStyle } = computePhotoTransformCSS(correction)

          return (
            <div key={photo.hothash} className="relative group">
              <div style={wrapperStyle as CSSProperties} className="w-[100px] h-[100px]">
                <img
                  src={`data:image/jpeg;base64,${photo.hotpreview_b64}`}
                  alt=""
                  style={imgStyle}
                  className="w-[100px] h-[100px] object-cover rounded-sm"
                />
              </div>

              {photo.is_stack_cover && (
                <div className="absolute top-0.5 left-0.5 bg-yellow-500 text-black text-[9px] font-bold px-1 rounded leading-tight pointer-events-none">
                  cover
                </div>
              )}

              <div className="absolute inset-0 flex flex-col justify-end opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-t from-black/80 to-transparent rounded-sm">
                <div className="flex gap-1 p-1 justify-center">
                  {!photo.is_stack_cover && (
                    <button
                      onClick={() => coverMut.mutate(photo.hothash)}
                      className="text-[9px] bg-yellow-500 text-black px-1 py-0.5 rounded font-medium hover:bg-yellow-400"
                    >
                      Cover
                    </button>
                  )}
                  <a
                    href={`${getBaseUrl()}/photos/${photo.hothash}/download`}
                    className="text-[9px] bg-gray-700 text-white px-1 py-0.5 rounded hover:bg-gray-600"
                  >
                    ↓
                  </a>
                  <button
                    onClick={() => removeMut.mutate(photo.hothash)}
                    className="text-[9px] bg-red-700 text-white px-1 py-0.5 rounded hover:bg-red-600"
                  >
                    ×
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
