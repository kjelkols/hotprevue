import { useNavigate } from 'react-router-dom'
import type { PhotoListItem } from '../../types/api'
import type { Granularity } from './useTimelineData'
import CloudDots, { stableRandom } from './CloudDots'

export const RULER_W = 80

export interface RowData {
  key: string
  type: Granularity
  y: number
  height: number
  label: string
  subLabel: string
  count: number
  photos: PhotoListItem[]
  isToday: boolean
  isMajor: boolean
  dateFrom: string   // ISO date for browse navigation
  dateTo: string
}

interface Props {
  row: RowData
  maxCount: number
  containerWidth: number
  pxPerDay: number
}

function clamp01(v: number) { return Math.max(0, Math.min(1, v)) }

export default function TimelineRow({ row, maxCount, containerWidth, pxPerDay }: Props) {
  const navigate = useNavigate()
  const { y, height, label, subLabel, count, photos, isToday, isMajor, key } = row

  // Crossfade: cloud fades out, thumbnails fade in
  const cloudOpacity = clamp01(1 - (pxPerDay - 20) / 30)   // 1→0 over pxPerDay 20–50
  const thumbOpacity = clamp01((pxPerDay - 20) / 30)        // 0→1 over pxPerDay 20–50
  const thumbBlur = Math.max(0, 10 * clamp01(1 - (pxPerDay - 8) / 25)) // blur fades out 8→33

  const contentW = containerWidth - RULER_W
  const thumbSize = Math.min(Math.max(height - 4, 16), 90)
  const tiny = height < 16

  // Stable jitter for micro-image cloud shape
  const jitterMax = Math.max(0, (height - thumbSize) / 2)

  return (
    <div
      className={`absolute left-0 right-0 flex border-b ${
        isToday ? 'border-blue-700/50' : isMajor ? 'border-gray-700' : 'border-gray-800/30'
      } ${isToday ? 'bg-blue-950/15' : ''}`}
      style={{ top: y, height: Math.max(height, 1) }}
    >
      {/* Ruler */}
      <div
        className={`shrink-0 flex flex-col justify-center px-2 border-r ${
          isMajor ? 'border-gray-700 bg-gray-900/50' : 'border-gray-800/30'
        }`}
        style={{ width: RULER_W }}
      >
        {subLabel && !tiny && (
          <span className="text-gray-500 leading-none" style={{ fontSize: 9 }}>{subLabel}</span>
        )}
        <span
          className={`font-mono leading-none ${
            isToday ? 'text-blue-400 font-bold' : isMajor ? 'text-gray-200 font-semibold' : 'text-gray-500'
          }`}
          style={{ fontSize: tiny ? 7 : height < 32 ? 11 : 13 }}
        >
          {label}
        </span>
      </div>

      {/* Content: cloud + thumbnails */}
      <div className="relative flex-1 overflow-hidden">
        {/* Cloud layer */}
        {cloudOpacity > 0.01 && (
          <CloudDots
            count={count} seed={key}
            width={contentW} height={height}
            opacity={cloudOpacity}
          />
        )}

        {/* Thumbnail layer */}
        {photos.length > 0 && height >= 14 && thumbOpacity > 0.01 && (
          <div
            className="absolute inset-0 flex flex-wrap content-start gap-0.5 p-0.5 overflow-hidden"
            style={{
              opacity: thumbOpacity,
              filter: thumbBlur > 0 ? `blur(${thumbBlur}px)` : undefined,
            }}
          >
            {photos.map((p, i) => {
              const jx = jitterMax > 2 ? (stableRandom(p.hothash, 1) - 0.5) * jitterMax : 0
              const jy = jitterMax > 2 ? (stableRandom(p.hothash, 2) - 0.5) * jitterMax : 0
              return (
                <img
                  key={p.hothash}
                  src={`data:image/jpeg;base64,${p.hotpreview_b64}`}
                  className="rounded-sm object-cover cursor-pointer hover:ring-1 hover:ring-blue-400 shrink-0"
                  style={{
                    width: thumbSize,
                    height: thumbSize,
                    transform: jitterMax > 2 ? `translate(${jx}px,${jy}px)` : undefined,
                  }}
                  onClick={() => navigate(`/browse?taken_from=${row.dateFrom}&taken_to=${row.dateTo}&title=${row.label}${row.subLabel ? ' ' + row.subLabel : ''}`)}
                  title={p.taken_at ?? ''}
                />
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
