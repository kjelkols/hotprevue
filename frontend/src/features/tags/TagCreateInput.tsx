import { useState, useEffect, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createTag, similarTags } from '../../api/tags'
import type { TagSimilar } from '../../types/api'

export default function TagCreateInput() {
  const queryClient = useQueryClient()
  const [value, setValue] = useState('')
  const [suggestions, setSuggestions] = useState<TagSimilar[]>([])
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (value.trim().length < 2) { setSuggestions([]); return }
    debounceRef.current = setTimeout(async () => {
      const results = await similarTags(value.trim())
      setSuggestions(results)
    }, 300)
  }, [value])

  const mutation = useMutation({
    mutationFn: () => createTag(value.trim()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] })
      setValue('')
      setSuggestions([])
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!value.trim()) return
    mutation.mutate()
  }

  return (
    <form onSubmit={handleSubmit} className="relative">
      <div className="flex gap-2">
        <input
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder="Ny tag…"
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gray-500"
        />
        <button
          type="submit"
          disabled={!value.trim() || mutation.isPending}
          className="rounded-lg bg-gray-700 px-3 py-2 text-sm text-gray-200 hover:bg-gray-600 disabled:opacity-40 transition-colors"
        >
          Legg til
        </button>
      </div>
      {mutation.isError && (
        <p className="text-xs text-red-400 mt-1">
          {mutation.error instanceof Error ? mutation.error.message : 'Feil'}
        </p>
      )}
      {suggestions.length > 0 && (
        <ul className="absolute top-full left-0 right-0 mt-1 z-10 bg-gray-800 border border-gray-700 rounded-lg overflow-hidden shadow-xl">
          <li className="px-3 py-1.5 text-xs text-gray-500">Lignende tags:</li>
          {suggestions.map(s => (
            <li
              key={s.id}
              className="px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 cursor-pointer flex justify-between"
              onClick={() => { setValue(s.name); setSuggestions([]) }}
            >
              <span>{s.name}</span>
              <span className="text-gray-500 text-xs">{s.photo_count} bilder</span>
            </li>
          ))}
        </ul>
      )}
    </form>
  )
}
