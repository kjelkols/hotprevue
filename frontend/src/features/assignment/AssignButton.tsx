import useAssignmentStore from '../../stores/useAssignmentStore'

export default function AssignButton() {
  const open = useAssignmentStore(s => s.open)

  return (
    <div className="flex rounded-lg overflow-hidden border border-gray-600">
      <button
        type="button"
        onClick={() => open('event')}
        className="px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
      >
        Event
      </button>
      <div className="w-px bg-gray-600" />
      <button
        type="button"
        onClick={() => open('collection')}
        className="px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
      >
        Samling
      </button>
      <div className="w-px bg-gray-600" />
      <button
        type="button"
        onClick={() => open('tag')}
        className="px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
      >
        Tag
      </button>
    </div>
  )
}
