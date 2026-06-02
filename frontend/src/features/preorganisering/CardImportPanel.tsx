import CopySection from '../registration/CopySection'
import usePreorganiserStore from '../../stores/usePreorganiserStore'

interface Props {
  sourcePath: string
  onClose: () => void
}

export default function CardImportPanel({ sourcePath, onClose }: Props) {
  const setCurrentDir = usePreorganiserStore(s => s.setCurrentDir)

  function handleCopyCompleted(destPath: string) {
    setCurrentDir(destPath)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-full max-w-lg rounded-xl border border-gray-700 bg-gray-950 p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Kopier fra minnekort</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl leading-none"
          >
            ×
          </button>
        </div>
        <CopySection
          sourcePath={sourcePath}
          onCopyCompleted={handleCopyCompleted}
        />
      </div>
    </div>
  )
}
