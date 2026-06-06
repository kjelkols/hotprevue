import { useNavigate } from 'react-router-dom'
import type { PhotoListItem } from '../../types/api'
import type { Granularity } from './useTimelineData'

export const RULER_W = 80
export const DENSITY_W = 44

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
}

interface Props {
  row: RowData
  maxCount: number
  containerWidth: number
  showThumbnails: boolean
}

export default function TimelineRow({ row, maxCount, containerWidth, showThumbnails }: Props) {
  const navigate = useNavigate()
  const { y, height, label, subLabel, count, photos, isToday, isMajor } = row

  const densityRatio = maxCount > 0 ? Math.log1p(count) / Math.log1p(maxCount) : 0
  const barW = Math.round(densityRatio * (DENSITY_W - 6))
  const barH = Math.max(2, Math.min(height - 4, 14))
  const thumbAreaW = containerWidth - RULER_W - DENSITY_W
  const thumbSize = Math.min(Math.max(height - 4, 20), 80)
  const tiny = height < 20

  return (
    <div
      className={`absolute left-0 right-0 flex border-b ${
        isToday ? 'border-blue-700/60' : isMajor ? 'border-gray-700' : 'border-gray-800/40'
      } ${isToday ? 'bg-blue-950/20' : ''}`}
      style={{ top: y, height: Math.max(height, 1) }}
    >
      {/* Ruler */}
      <div
        className={`shrink-0 flex flex-col justify-center px-2 border-r ${
          isMajor ? 'border-gray-700 bg-gray-900/60' : 'border-gray-800/40'
        }`}
        style={{ width: RULER_W }}
      >
        {subLabel && !tiny && (
          <span className="text-gray-500 leading-none" style={{ fontSize: 9 }}>{subLabel}</span>
        )}
        <span
          className={`font-mono leading-none ${
            isToday ? 'text-blue-400 font-bold' :
            isMajor ? 'text-gray-200 font-semibold' : 'text-gray-500'
          }`}
          style={{ fontSize: tiny ? 8 : height < 32 ? 11 : 13 }}
        >
          {label}
        </span>
      </div>

      {/* Density bar */}
      <div
        className={`shrink-0 flex items-center px-1 border-r border-gray-800/30`}
        style={{ width: DENSITY_W }}
      >
        {barW > 0 && (
          <div
            className="rounded-sm bg-blue-500"
            style={{ width: barW, height: barH, opacity: 0.4 + densityRatio * 0.6 }}
          />
        )}
      </div>

      {/* Content area */}
      <div className="flex items-center overflow-hidden" style={{ width: thumbAreaW }}>
        {showThumbnails && photos.length > 0 && height >= 24 ? (
          <div className="flex flex-wrap gap-0.5 p-0.5 content-start overflow-hidden h-full">
            {photos.map(p => (
              <img
                key={p.hothash}
                src={`data:image/jpeg;base64,${p.hotpreview_b64}`}
                className="rounded-sm cursor-pointer object-cover shrink-0 hover:ring-1 hover:ring-blue-400"
                style={{ width: thumbSize, height: thumbSize }}
                onClick={() => navigate(`/photos/${p.hothash}`)}
                alt=""
              />
            ))}
          </div>
        ) : count > 0 && !tiny ? (
          <span className="px-3 text-xs text-gray-600">{count} bilder</span>
        ) : null}
      </div>
    </div>
  )
}
