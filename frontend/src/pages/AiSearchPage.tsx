import { useState, useEffect, useRef } from 'react'
import PhotoGrid from '../features/browse/PhotoGrid'
import { useAiSearch } from '../hooks/useAiSearch'

export default function AiSearchPage() {
  const [input, setInput] = useState('')
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => setQuery(input), 400)
    return () => clearTimeout(timer)
  }, [input])

  const { photos, isLoading, isError, isEmpty } = useAiSearch(query)

  return (
    <div className="min-h-full bg-gray-950 text-white">
      <div className="px-4 py-3 border-b border-gray-800">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Søk etter bilder med ord… f.eks. «solnedgang» eller «hund på stranden»"
          className="w-full rounded-lg bg-gray-800 px-4 py-2 text-sm text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="p-4">
        {isEmpty && (
          <p className="text-center text-gray-500 py-20">Ingen treff for «{query}»</p>
        )}
        {!isEmpty && (
          <PhotoGrid
            photos={photos}
            isLoading={isLoading}
            isError={isError}
          />
        )}
        {!query && (
          <p className="text-center text-gray-600 py-20 text-sm">Skriv inn en beskrivelse for å finne bilder</p>
        )}
      </div>
    </div>
  )
}
