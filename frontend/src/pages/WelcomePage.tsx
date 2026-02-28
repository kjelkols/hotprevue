import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { setBaseUrl } from '../api/client'
import type { AppConfig } from '../types/api'

interface Props {
  onSaved: (config: AppConfig) => void
}

type Mode = 'choose' | 'remote'

export default function WelcomePage({ onSaved }: Props) {
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('choose')
  const [url, setUrl] = useState('http://localhost:8000')
  const [status, setStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function testConnection() {
    setStatus('testing')
    setErrorMsg('')
    try {
      const cleanUrl = url.replace(/\/$/, '')
      const res = await fetch(`${cleanUrl}/health`)
      if (res.ok) {
        setStatus('ok')
      } else {
        setStatus('error')
        setErrorMsg(`Server svarte med ${res.status}`)
      }
    } catch {
      setStatus('error')
      setErrorMsg('Kunne ikke koble til serveren')
    }
  }

  async function save() {
    const cfg: AppConfig = { backendUrl: url.replace(/\/$/, '') }
    if (window.electron) await window.electron.setConfig(cfg)
    setBaseUrl(cfg.backendUrl)
    onSaved(cfg)
    navigate('/')
  }

  if (mode === 'choose') {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950">
        <div className="w-full max-w-md rounded-xl bg-gray-900 p-8 shadow-xl">
          <h1 className="mb-2 text-3xl font-bold text-white">Hotprevue</h1>
          <p className="mb-8 text-sm text-gray-400">Velg hvordan du vil kjøre systemet</p>

          <div className="flex flex-col gap-4">
            <button
              onClick={save}
              className="rounded-xl bg-blue-600 px-6 py-4 text-left hover:bg-blue-500"
            >
              <div className="font-semibold text-white">Lokal installasjon</div>
              <div className="mt-1 text-sm text-blue-200">
                Backend kjører lokalt på denne maskinen
              </div>
            </button>

            <button
              onClick={() => setMode('remote')}
              className="rounded-xl bg-gray-800 px-6 py-4 text-left hover:bg-gray-700"
            >
              <div className="font-semibold text-white">Sentral server</div>
              <div className="mt-1 text-sm text-gray-400">
                Koble til en eksisterende Hotprevue-server
              </div>
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen items-center justify-center bg-gray-950">
      <div className="w-full max-w-md rounded-xl bg-gray-900 p-8 shadow-xl">
        <button onClick={() => setMode('choose')} className="mb-6 text-sm text-gray-400 hover:text-white">
          ← Tilbake
        </button>
        <h1 className="mb-2 text-2xl font-bold text-white">Sentral server</h1>
        <p className="mb-6 text-sm text-gray-400">Oppgi URL til Hotprevue-backend</p>

        <label className="mb-1 block text-sm text-gray-300">Backend-URL</label>
        <input
          type="url"
          value={url}
          onChange={e => { setUrl(e.target.value); setStatus('idle') }}
          className="mb-4 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white outline-none focus:border-blue-500"
          placeholder="http://localhost:8000"
        />

        <div className="flex gap-3">
          <button
            onClick={testConnection}
            disabled={status === 'testing'}
            className="rounded-lg bg-gray-700 px-4 py-2 text-sm font-medium text-white hover:bg-gray-600 disabled:opacity-50"
          >
            {status === 'testing' ? 'Tester…' : 'Test tilkobling'}
          </button>
          {status === 'ok' && (
            <button
              onClick={save}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
            >
              Lagre og fortsett
            </button>
          )}
        </div>

        {status === 'ok' && <p className="mt-3 text-sm text-green-400">Tilkoblet!</p>}
        {status === 'error' && <p className="mt-3 text-sm text-red-400">{errorMsg}</p>}
      </div>
    </div>
  )
}
