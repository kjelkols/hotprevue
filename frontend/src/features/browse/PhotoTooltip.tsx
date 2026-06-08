import { useLayoutEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { getStack } from '../../api/stacks'
import type { PhotoListItem } from '../../types/api'

interface Props {
  photo: PhotoListItem
  anchorRect: DOMRect
  stackCount?: number
}

function formatTime(taken_at: string | null): string | null {
  if (!taken_at) return null
  const d = new Date(taken_at)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function PhotoTooltip({ photo, anchorRect, stackCount }: Props) {
  const isStack = photo.is_stack_cover && !!photo.stack_id
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  const { data: stackDetail } = useQuery({
    queryKey: ['stack', photo.stack_id],
    queryFn: () => getStack(photo.stack_id!),
    enabled: isStack,
  })

  useLayoutEffect(() => {
    const el = tooltipRef.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()

    const showAbove = anchorRect.top > height + 16
    const top = showAbove
      ? anchorRect.top - height - 8
      : anchorRect.bottom + 8

    const idealLeft = anchorRect.left + anchorRect.width / 2 - width / 2
    const left = Math.max(8, Math.min(idealLeft, window.innerWidth - width - 8))

    setPos({ top, left })
  }, [anchorRect, stackDetail])

  const time = formatTime(photo.taken_at)
  const hasGps = photo.location_lat != null && photo.location_lng != null

  const content = isStack ? (
    <div>
      <div className="text-xs font-medium text-gray-300 mb-1.5">
        Stack · {stackCount ?? stackDetail?.photos.length ?? '…'} bilder
      </div>
      {stackDetail ? (
        <div className="flex flex-wrap gap-0.5 max-w-[200px]">
          {stackDetail.photos.slice(0, 12).map(p => (
            <img
              key={p.hothash}
              src={`data:image/jpeg;base64,${p.hotpreview_b64}`}
              className="w-5 h-5 object-cover rounded-sm flex-shrink-0"
              alt=""
            />
          ))}
          {stackDetail.photos.length > 12 && (
            <span className="text-[10px] text-gray-400 self-center ml-0.5">
              +{stackDetail.photos.length - 12}
            </span>
          )}
        </div>
      ) : (
        <div className="text-[10px] text-gray-500">Laster…</div>
      )}
    </div>
  ) : (
    <div className="flex flex-col gap-0.5 min-w-[60px]">
      {time && <span className="text-xs text-gray-200">{time}</span>}
      {hasGps && (
        <span className="text-[10px] text-gray-400">📍 GPS</span>
      )}
      {!time && !hasGps && (
        <span className="text-xs text-gray-500">Ingen metadata</span>
      )}
    </div>
  )

  return ReactDOM.createPortal(
    <div
      ref={tooltipRef}
      className="fixed z-[300] bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 shadow-xl pointer-events-none"
      style={{ top: pos.top, left: pos.left }}
    >
      {content}
    </div>,
    document.body
  )
}
