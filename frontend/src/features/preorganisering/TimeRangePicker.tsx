import { useState } from 'react'
import type { PrescanFileEntry } from '../../types/api'
import usePreorganiserStore from '../../stores/usePreorganiserStore'

interface Props {
  files: PrescanFileEntry[]
}

export default function TimeRangePicker({ files }: Props) {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const selectByTimeRange = usePreorganiserStore(s => s.selectByTimeRange)

  function handleSelect() {
    if (!from || !to) return
    selectByTimeRange(files, new Date(from), new Date(to))
  }

  const datedFiles = files.filter(f => f.taken_at).length

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-400">
        Velg tidsrom ({datedFiles} av {files.length} bilder har dato)
      </p>
      <div className="flex gap-2">
        <input
          type="datetime-local"
          value={from}
          onChange={e => setFrom(e.target.value)}
          className="flex-1 rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-white"
        />
        <span className="text-gray-500 self-center">–</span>
        <input
          type="datetime-local"
          value={to}
          onChange={e => setTo(e.target.value)}
          className="flex-1 rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-white"
        />
      </div>
      <button
        onClick={handleSelect}
        disabled={!from || !to}
        className="w-full rounded bg-gray-700 px-3 py-1.5 text-sm text-white hover:bg-gray-600 disabled:opacity-40"
      >
        Velg bilder i tidsrommet
      </button>
    </div>
  )
}
