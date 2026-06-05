import { useState } from 'react'
import { getBaseUrl } from '../../api/client'

type Size = 'full' | 'medium' | 'small'

const SIZE_LABELS: Record<Size, string> = {
  full:   'Full (maks ~1200px)',
  medium: 'Medium (maks 800px)',
  small:  'Liten (maks 600px)',
}

interface Props {
  hothash: string
}

function downloadUrl(hothash: string, size: Size): string {
  return `${getBaseUrl()}/photos/${hothash}/download?size=${size}`
}

function suggestedFilename(hothash: string): string {
  return `${hothash}.jpg`
}

export default function PhotoDownloadShare({ hothash }: Props) {
  const [open, setOpen] = useState(false)
  const [sharing, setSharing] = useState(false)

  const canShare =
    typeof navigator !== 'undefined' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [new File([], 'test.jpg', { type: 'image/jpeg' })] })

  async function handleShare() {
    setSharing(true)
    try {
      const res = await fetch(downloadUrl(hothash, 'medium'))
      const blob = await res.blob()
      const file = new File([blob], suggestedFilename(hothash), { type: 'image/jpeg' })
      await navigator.share({ files: [file], title: filename })
    } catch {
      // user cancelled or share failed — silent
    } finally {
      setSharing(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <button
          onClick={() => setOpen(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-sm text-gray-100 transition-colors"
        >
          ↓ Last ned
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="absolute right-0 top-full mt-1 z-20 bg-gray-800 border border-gray-700 rounded shadow-lg min-w-max">
              {(Object.keys(SIZE_LABELS) as Size[]).map(size => (
                <a
                  key={size}
                  href={downloadUrl(hothash, size)}
                  download={suggestedFilename(hothash)}
                  onClick={() => setOpen(false)}
                  className="block px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 transition-colors"
                >
                  {SIZE_LABELS[size]}
                </a>
              ))}
            </div>
          </>
        )}
      </div>

      {canShare && (
        <button
          onClick={handleShare}
          disabled={sharing}
          className="px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-sm text-gray-100 transition-colors disabled:opacity-50"
        >
          {sharing ? '…' : '↗ Del'}
        </button>
      )}
    </div>
  )
}
