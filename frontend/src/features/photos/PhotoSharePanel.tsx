import { useState, useRef, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { getBaseUrl } from '../../api/client'
import { patchPhoto } from '../../api/photos'
import type { PhotoDetail } from '../../types/api'

type Size = 'full' | 'medium' | 'small'

const SIZE_LABELS: Record<Size, string> = {
  full: 'Full (maks ~1200px)',
  medium: 'Medium (maks 800px)',
  small: 'Liten (maks 600px)',
}

interface Props {
  photo: PhotoDetail
}

function downloadUrl(hothash: string, size: Size): string {
  return `${getBaseUrl()}/photos/${hothash}/download?size=${size}`
}

function shareUrl(hothash: string): string {
  return `${window.location.origin}/share/photo/${hothash}/og`
}

export default function PhotoSharePanel({ photo }: Props) {
  const queryClient = useQueryClient()
  const [downloadOpen, setDownloadOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [captionDraft, setCaptionDraft] = useState(photo.share_caption ?? '')
  const captionTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setCaptionDraft(photo.share_caption ?? '')
  }, [photo.share_caption])

  const mutation = useMutation({
    mutationFn: (data: Parameters<typeof patchPhoto>[1]) => patchPhoto(photo.hothash, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['photo', photo.hothash] }),
  })

  function toggleShared() {
    mutation.mutate({ is_shared: !photo.is_shared })
  }

  function toggleDownloads() {
    mutation.mutate({ share_downloads: !photo.share_downloads })
  }

  function handleCaptionChange(value: string) {
    setCaptionDraft(value)
    if (captionTimer.current) clearTimeout(captionTimer.current)
    captionTimer.current = setTimeout(() => {
      mutation.mutate({ share_caption: value || null })
    }, 700)
  }

  function copyUrl() {
    navigator.clipboard.writeText(shareUrl(photo.hothash))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex items-center gap-2">
      {/* Download dropdown */}
      <div className="relative">
        <button
          onClick={() => { setDownloadOpen(v => !v); setShareOpen(false) }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-sm text-gray-100 transition-colors"
        >
          ↓ Last ned
        </button>
        {downloadOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setDownloadOpen(false)} />
            <div className="absolute right-0 top-full mt-1 z-20 bg-gray-800 border border-gray-700 rounded shadow-lg min-w-max">
              {(Object.keys(SIZE_LABELS) as Size[]).map(size => (
                <a
                  key={size}
                  href={downloadUrl(photo.hothash, size)}
                  download={`${photo.hothash}.jpg`}
                  onClick={() => setDownloadOpen(false)}
                  className="block px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 transition-colors"
                >
                  {SIZE_LABELS[size]}
                </a>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Share toggle button + panel */}
      <div className="relative">
        <button
          onClick={() => { setShareOpen(v => !v); setDownloadOpen(false) }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors ${
            photo.is_shared
              ? 'bg-blue-700 hover:bg-blue-600 text-white'
              : 'bg-gray-700 hover:bg-gray-600 text-gray-100'
          }`}
        >
          ↗ Del{photo.is_shared ? '' : '…'}
        </button>
        {shareOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShareOpen(false)} />
            <div className="absolute right-0 top-full mt-1 z-20 bg-gray-800 border border-gray-700 rounded shadow-lg w-80 p-4 flex flex-col gap-3">
              <p className="text-sm font-medium text-gray-100">Del dette bildet</p>

              {/* is_shared toggle */}
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={photo.is_shared}
                  onChange={toggleShared}
                  disabled={mutation.isPending}
                  className="w-4 h-4 rounded accent-blue-500"
                />
                <span className="text-sm text-gray-200">Gjør offentlig tilgjengelig</span>
              </label>

              {photo.is_shared && (
                <>
                  {/* URL */}
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      value={shareUrl(photo.hothash)}
                      className="flex-1 min-w-0 rounded bg-gray-700 px-2 py-1 text-xs text-gray-300 font-mono truncate"
                    />
                    <button
                      onClick={copyUrl}
                      className="shrink-0 rounded px-2 py-1 text-xs bg-gray-600 hover:bg-gray-500 transition-colors"
                    >
                      {copied ? '✓' : 'Kopi'}
                    </button>
                  </div>

                  {/* Caption */}
                  <input
                    type="text"
                    placeholder="Bildetekst (valgfri)"
                    value={captionDraft}
                    onChange={e => handleCaptionChange(e.target.value)}
                    className="rounded bg-gray-700 px-2 py-1.5 text-sm text-gray-200 placeholder-gray-500"
                  />

                  {/* share_downloads toggle */}
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={photo.share_downloads}
                      onChange={toggleDownloads}
                      disabled={mutation.isPending}
                      className="w-4 h-4 rounded accent-blue-500"
                    />
                    <span className="text-sm text-gray-200">Tillat nedlasting</span>
                  </label>

                  {/* view count */}
                  <p className="text-xs text-gray-500">
                    Vist {photo.share_views} {photo.share_views === 1 ? 'gang' : 'ganger'}
                  </p>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
