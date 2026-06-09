import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getSettings } from '../../api/settings'
import { publishPhotoPublic, revokePhotoPublic } from '../../api/share'
import type { PhotoDetail } from '../../types/api'

interface Props {
  photo: PhotoDetail
}

function formatExpiry(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function PhotoPublicShare({ photo }: Props) {
  const queryClient = useQueryClient()
  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: getSettings })
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const relayConfigured = Boolean(settings?.global_?.public_share_relay_url)

  const isActive = Boolean(photo.public_share_token)
  const publicUrl = isActive && settings?.global_?.public_share_base_url
    ? `${settings.global_.public_share_base_url.replace(/\/$/, '')}/${photo.public_share_token}.jpg`
    : null

  const publishMut = useMutation({
    mutationFn: () => publishPhotoPublic(photo.hothash),
    onSuccess: () => {
      setError(null)
      queryClient.invalidateQueries({ queryKey: ['photo', photo.hothash] })
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Ukjent feil'),
  })

  const revokeMut = useMutation({
    mutationFn: () => revokePhotoPublic(photo.hothash),
    onSuccess: () => {
      setError(null)
      queryClient.invalidateQueries({ queryKey: ['photo', photo.hothash] })
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Ukjent feil'),
  })

  function copyUrl() {
    if (!publicUrl) return
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(publicUrl).catch(() => _copyFallback(publicUrl))
    } else {
      _copyFallback(publicUrl)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function _copyFallback(text: string) {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.focus(); ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
  }

  if (!relayConfigured) {
    return (
      <div className="rounded bg-gray-800/60 border border-gray-700 px-3 py-2 text-xs text-gray-500">
        Offentlig deling ikke konfigurert.{' '}
        <a href="/#/settings" className="text-blue-400 hover:underline">Gå til innstillinger</a>
      </div>
    )
  }

  return (
    <div className="rounded bg-gray-800/60 border border-gray-700 px-3 py-3 flex flex-col gap-2.5">
      <p className="text-xs font-medium text-gray-300 uppercase tracking-wide">Offentlig lenke</p>

      {isActive ? (
        <>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={publicUrl ?? ''}
              className="flex-1 min-w-0 rounded bg-gray-700 px-2 py-1 text-xs text-gray-300 font-mono truncate"
            />
            <button
              onClick={copyUrl}
              className="shrink-0 rounded px-2 py-1 text-xs bg-gray-600 hover:bg-gray-500 transition-colors"
            >
              {copied ? '✓' : 'Kopi'}
            </button>
          </div>
          {photo.public_share_expires_at && (
            <p className="text-xs text-gray-500">Utløper {formatExpiry(photo.public_share_expires_at)}</p>
          )}
          <button
            onClick={() => revokeMut.mutate()}
            disabled={revokeMut.isPending}
            className="self-start rounded px-3 py-1 text-xs bg-red-900/60 hover:bg-red-800/60 text-red-300 transition-colors disabled:opacity-50"
          >
            {revokeMut.isPending ? 'Trekker tilbake…' : 'Trekk tilbake lenke'}
          </button>
        </>
      ) : (
        <button
          onClick={() => publishMut.mutate()}
          disabled={publishMut.isPending}
          className="self-start rounded px-3 py-1.5 text-xs bg-blue-700 hover:bg-blue-600 text-white transition-colors disabled:opacity-50"
        >
          {publishMut.isPending ? 'Publiserer…' : 'Publiser offentlig'}
        </button>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}
