const MONTHS = [
  'januar','februar','mars','april','mai','juni',
  'juli','august','september','oktober','november','desember',
]

export function formatEventDate(start: string | null, end: string | null): string {
  if (!start) return ''
  const s = new Date(start + 'T00:00:00')
  if (!end || end === start) {
    return `${s.getDate()}. ${MONTHS[s.getMonth()]} ${s.getFullYear()}`
  }
  const e = new Date(end + 'T00:00:00')
  if (s.getFullYear() !== e.getFullYear()) {
    return `${s.getDate()}. ${MONTHS[s.getMonth()]} ${s.getFullYear()} – ${e.getDate()}. ${MONTHS[e.getMonth()]} ${e.getFullYear()}`
  }
  if (s.getMonth() !== e.getMonth()) {
    return `${s.getDate()}. ${MONTHS[s.getMonth()]} – ${e.getDate()}. ${MONTHS[e.getMonth()]} ${s.getFullYear()}`
  }
  return `${s.getDate()}–${e.getDate()}. ${MONTHS[s.getMonth()]} ${s.getFullYear()}`
}
