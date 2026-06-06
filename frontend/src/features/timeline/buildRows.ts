import type { TimelineBucket, PhotoListItem } from '../../types/api'
import type { Granularity } from './useTimelineData'
import type { RowData } from './TimelineRow'
import { DAY_MS } from './useTimelineData'

const MONTH_SHORT = ['jan','feb','mar','apr','mai','jun','jul','aug','sep','okt','nov','des']
const BUFFER = 4 * DAY_MS

function msToY(ms: number, topMs: number, pxPerDay: number) {
  return (ms - topMs) * pxPerDay / DAY_MS
}

function isoDate(ms: number) {
  return new Date(ms).toISOString().slice(0, 10)
}

export function buildRows(
  topMs: number,
  bottomMs: number,
  pxPerDay: number,
  granularity: Granularity,
  bucketMap: Map<string, number>,
  photosByDay: Map<string, PhotoListItem[]>,
  showThumbnails: boolean,
  yearBounds: { minYear: number; maxYear: number } | null,
): RowData[] {
  const rows: RowData[] = []
  const from = topMs - BUFFER
  const to = bottomMs + BUFFER
  const todayStr = new Date().toISOString().slice(0, 10)

  // Clip iteration to data range when at year/month level
  const clipFrom = yearBounds ? Math.max(from, Date.UTC(yearBounds.minYear, 0, 1) - BUFFER) : from
  const clipTo = yearBounds ? Math.min(to, Date.UTC(yearBounds.maxYear + 1, 0, 1) + BUFFER) : to

  if (granularity === 'day') {
    let d = new Date(from)
    d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    while (d.getTime() < to) {
      const ms = d.getTime()
      const dateStr = d.toISOString().slice(0, 10)
      const dom = d.getUTCDate()
      const nextDay = ms + DAY_MS
      rows.push({
        key: dateStr,
        type: 'day',
        y: msToY(ms, topMs, pxPerDay),
        height: pxPerDay,
        label: String(dom),
        subLabel: dom === 1 ? `${MONTH_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()}` : '',
        count: bucketMap.get(dateStr) ?? 0,
        photos: showThumbnails ? (photosByDay.get(dateStr) ?? []) : [],
        isToday: dateStr === todayStr,
        isMajor: dom === 1,
        dateFrom: dateStr,
        dateTo: isoDate(nextDay),
      })
      d.setUTCDate(d.getUTCDate() + 1)
    }
  } else if (granularity === 'month') {
    let d = new Date(clipFrom)
    d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
    while (d.getTime() < clipTo) {
      const ms = d.getTime()
      const y = d.getUTCFullYear()
      const m = d.getUTCMonth()
      const days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
      const key = `${y}-${m + 1}`
      const nextMonth = Date.UTC(y, m + 1, 1)
      rows.push({
        key,
        type: 'month',
        y: msToY(ms, topMs, pxPerDay),
        height: days * pxPerDay,
        label: MONTH_SHORT[m],
        subLabel: m === 0 ? String(y) : '',
        count: bucketMap.get(key) ?? 0,
        photos: [],
        isToday: false,
        isMajor: m === 0,
        dateFrom: `${y}-${String(m + 1).padStart(2, '0')}-01`,
        dateTo: isoDate(nextMonth),
      })
      d.setUTCMonth(d.getUTCMonth() + 1)
    }
  } else {
    let d = new Date(clipFrom)
    d = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
    while (d.getTime() < clipTo) {
      const ms = d.getTime()
      const y = d.getUTCFullYear()
      const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
      rows.push({
        key: String(y),
        type: 'year',
        y: msToY(ms, topMs, pxPerDay),
        height: (leap ? 366 : 365) * pxPerDay,
        label: String(y),
        subLabel: '',
        count: bucketMap.get(String(y)) ?? 0,
        photos: [],
        isToday: false,
        isMajor: true,
        dateFrom: `${y}-01-01`,
        dateTo: `${y + 1}-01-01`,
      })
      d.setUTCFullYear(d.getUTCFullYear() + 1)
    }
  }
  return rows
}
