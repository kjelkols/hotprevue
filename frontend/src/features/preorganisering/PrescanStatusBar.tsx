import type { PrescanJobStatus } from '../../types/api'

interface Props {
  job: PrescanJobStatus | null
}

export default function PrescanStatusBar({ job }: Props) {
  if (!job || job.status === 'completed' || job.status === 'cancelled') return null

  const percent = job.total > 0 ? Math.round((job.done / job.total) * 100) : 0

  return (
    <div className="flex items-center gap-3 border-t border-gray-800 bg-gray-950 px-4 py-2">
      <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-gray-800">
        <div
          className="h-full rounded-full bg-blue-600 transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="shrink-0 text-xs text-gray-400">
        {job.status === 'failed'
          ? `Skanning feilet: ${job.error ?? ''}`
          : `Skanner… ${job.done} / ${job.total}`}
      </span>
    </div>
  )
}
