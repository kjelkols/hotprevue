import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getSettings, patchGlobalSettings } from '../../api/settings'

function SaveRow({ onSave, pending, saved }: { onSave: () => void; pending: boolean; saved: boolean }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <button
        onClick={onSave}
        disabled={pending}
        className="rounded-xl bg-blue-600 px-6 py-2.5 font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
      >
        {pending ? 'Lagrer…' : 'Lagre'}
      </button>
      {saved && <span className="text-sm text-green-400">Lagret!</span>}
    </div>
  )
}

export default function PublicShareSettings() {
  const queryClient = useQueryClient()
  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: getSettings })

  const [relayUrl, setRelayUrl] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [ttlDays, setTtlDays] = useState(30)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!settings) return
    setRelayUrl(settings.global_.public_share_relay_url ?? '')
    setBaseUrl(settings.global_.public_share_base_url ?? '')
    setApiKey(settings.global_.public_share_api_key ?? '')
    setTtlDays(settings.global_.public_share_default_ttl_days ?? 30)
  }, [settings])

  const mutation = useMutation({
    mutationFn: patchGlobalSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
  })

  const isConfigured = Boolean(settings?.global_?.public_share_relay_url)

  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-400">
        Offentlig deling sender en kopi av forhåndsvisningsbildet (coldpreview) til en ekstern
        relayserver. Lenken er tilgjengelig for alle — uten innlogging.
      </p>

      {isConfigured && (
        <div className="flex items-center gap-2 rounded-lg bg-green-900/20 border border-green-800/40 px-3 py-2">
          <span className="h-2 w-2 rounded-full bg-green-500 shrink-0" />
          <span className="text-sm text-green-300">Relay konfigurert</span>
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-300">Relay-URL (API)</label>
        <input
          type="text"
          value={relayUrl}
          onChange={e => setRelayUrl(e.target.value)}
          className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white font-mono text-sm outline-none focus:border-blue-500"
          placeholder="https://relay.eksempel.no"
        />
        <p className="mt-1 text-xs text-gray-500">API-adressen til relay-applikasjonen (FastAPI).</p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-300">Offentlig base-URL</label>
        <input
          type="text"
          value={baseUrl}
          onChange={e => setBaseUrl(e.target.value)}
          className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white font-mono text-sm outline-none focus:border-blue-500"
          placeholder="https://del.eksempel.no"
        />
        <p className="mt-1 text-xs text-gray-500">
          nginx-rot der bilder er tilgjengelige. Delte bilder får URL {' '}
          <span className="font-mono text-gray-400">{(baseUrl || 'https://del.eksempel.no').replace(/\/$/, '')}/{'<token>'}.jpg</span>
        </p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-300">API-nøkkel</label>
        <input
          type="password"
          value={apiKey}
          onChange={e => setApiKey(e.target.value)}
          className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white font-mono text-sm outline-none focus:border-blue-500"
          placeholder="Hemmelig nøkkel for relay"
        />
        <p className="mt-1 text-xs text-gray-500">Sendes som <span className="font-mono">X-API-Key</span>-header til relay.</p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-300">Standard levetid (dager)</label>
        <input
          type="number"
          min={1}
          max={3650}
          value={ttlDays}
          onChange={e => setTtlDays(Number(e.target.value))}
          className="w-32 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white outline-none focus:border-blue-500"
        />
        <p className="mt-1 text-xs text-gray-500">Bilder slettes automatisk fra relay etter dette antall dager.</p>
      </div>

      <SaveRow
        onSave={() => mutation.mutate({
          public_share_relay_url: relayUrl || null,
          public_share_base_url: baseUrl || null,
          public_share_api_key: apiKey || null,
          public_share_default_ttl_days: ttlDays,
        })}
        pending={mutation.isPending}
        saved={saved}
      />
    </div>
  )
}
