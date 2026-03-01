export const MONTHS_NO = [
  'januar', 'februar', 'mars', 'april', 'mai', 'juni',
  'juli', 'august', 'september', 'oktober', 'november', 'desember',
]

export function monthName(month: number): string {
  return MONTHS_NO[month - 1] ?? '?'
}

/** "22. mars 2024" */
export function formatDay(day: number, month: number, year: number): string {
  return `${day}. ${monthName(month)} ${year}`
}

/** "Mars 2024" */
export function formatMonth(month: number, year: number): string {
  const name = monthName(month)
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${year}`
}

/** ISO date string "YYYY-MM-DD" for use with date_filter */
export function toIsoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}
