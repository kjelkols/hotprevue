import { useNavigate } from 'react-router-dom'
import type { HomeStats } from '../../types/api'

interface Props {
  stats: HomeStats
}

function fmt(n: number): string {
  return n.toLocaleString('nb-NO')
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' })
}

interface CardProps {
  value: string
  label: string
  onClick?: () => void
}

function StatCard({ value, label, onClick }: CardProps) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className="flex flex-col gap-1 rounded-xl bg-gray-800 px-4 py-3 text-left transition-colors enabled:hover:bg-gray-700 disabled:cursor-default"
    >
      <span className="text-2xl font-bold text-white tabular-nums">{value}</span>
      <span className="text-xs text-gray-400">{label}</span>
    </button>
  )
}

export default function HomeStatCards({ stats }: Props) {
  const navigate = useNavigate()
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <StatCard value={fmt(stats.total_photos)} label="bilder" onClick={() => navigate('/browse')} />
      <StatCard value={fmt(stats.photographers.filter(p => !p.is_unknown).length)} label="fotografer" onClick={() => navigate('/fotografer')} />
      <StatCard value={fmt(stats.total_events)} label="events" onClick={() => navigate('/events')} />
      <StatCard value={fmtDate(stats.last_registered_at)} label="sist registrert" onClick={() => navigate('/sessions')} />
    </div>
  )
}
