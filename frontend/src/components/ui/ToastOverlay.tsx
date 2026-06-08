import useToastStore from '../../stores/useToastStore'

export default function ToastOverlay() {
  const message = useToastStore(s => s.message)
  const clear = useToastStore(s => s.clear)

  if (!message) return null

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[200] max-w-sm w-full px-4">
      <div className="flex items-start gap-3 rounded-lg border border-red-700 bg-gray-900 px-4 py-3 shadow-xl">
        <span className="text-sm text-gray-200 flex-1">{message}</span>
        <button onClick={clear} className="text-gray-500 hover:text-white leading-none text-lg mt-0.5">×</button>
      </div>
    </div>
  )
}
