interface Props {
  notes: string
}

export default function SlideNotesPanel({ notes }: Props) {
  return (
    <div className="shrink-0 bg-gray-900 border-t border-gray-700 px-6 py-4 max-h-40 overflow-y-auto">
      <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Notater</p>
      <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{notes}</p>
    </div>
  )
}
