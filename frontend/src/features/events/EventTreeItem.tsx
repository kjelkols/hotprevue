import type { EventNode } from '../../types/api'

interface Props {
  event: EventNode
  onOpen: (event: EventNode) => void
  indent?: boolean
}

export default function EventTreeItem({ event, onOpen, indent = false }: Props) {
  return (
    <>
      <li>
        <button
          onClick={() => onOpen(event)}
          className={`w-full text-left rounded-xl bg-gray-800 px-4 py-3 hover:bg-gray-700 transition-colors ${indent ? 'ml-6' : ''}`}
        >
          <div className="flex items-baseline justify-between gap-4">
            <span className="font-medium truncate">{event.name}</span>
            <span className="text-sm text-gray-400 shrink-0">
              {event.photo_count} bilder
            </span>
          </div>
          {indent && <div className="text-xs text-gray-600 mt-0.5">del-event</div>}
        </button>
      </li>
      {event.children.map(child => (
        <EventTreeItem key={child.id} event={child} onOpen={onOpen} indent />
      ))}
    </>
  )
}
