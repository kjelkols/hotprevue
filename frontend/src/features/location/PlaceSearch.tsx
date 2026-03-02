import { useState } from 'react'

interface NominatimResult {
  lat: string
  lon: string
  display_name: string
}

interface Props {
  onSelect(coords: { lat: number; lng: number }): void
}

export default function PlaceSearch({ onSelect }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<NominatimResult[]>([])
  const [loading, setLoading] = useState(false)

  async function search() {
    if (!query.trim()) return
    setLoading(true)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5`,
        { headers: { 'Accept-Language': 'no,en' } }
      )
      const data: NominatimResult[] = await res.json()
      setResults(data)
    } finally {
      setLoading(false)
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter') search()
  }

  function pick(r: NominatimResult) {
    onSelect({ lat: parseFloat(r.lat), lng: parseFloat(r.lon) })
    setResults([])
    setQuery('')
  }

  return (
    <div className="relative" style={{ minWidth: 260 }}>
      <div className="flex gap-1">
        <input
          className="flex-1 bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          placeholder="Søk etter sted…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKey}
        />
        <button
          onClick={search}
          disabled={loading}
          className="bg-gray-700 hover:bg-gray-600 text-white text-sm px-3 py-1 rounded transition-colors disabled:opacity-50"
        >
          Søk
        </button>
      </div>
      {results.length > 0 && (
        <ul className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-600 rounded shadow-lg z-[1000] max-h-48 overflow-y-auto">
          {results.map((r, i) => (
            <li key={i}>
              <button
                onClick={() => pick(r)}
                className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-gray-700 transition-colors"
              >
                {r.display_name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
