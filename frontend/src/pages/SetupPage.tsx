import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { AppConfig } from '../types/api'

interface Props {
  onSaved: (config: AppConfig) => void
}

export default function SetupPage({ onSaved }: Props) {
  const navigate = useNavigate()
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
    } catch (e) {
      setStatus('error')
      setErrorMsg('Kunne ikke koble til serveren')
    }
  }

  async function save() {
    const cfg: AppConfig = { backendUrl: url.replace(/\/$/, '') }
    await window.electron.setConfig(cfg)
    onSaved(cfg)
    navigate('/')
  }

  return (
    <div className="flex h-screen items-center justify-center bg-gray-950">
      <div className="w-full max-w-md rounded-xl bg-gray-900 p-8 shadow-xl">
        <h1 className="mb-2 text-2xl font-bold text-white">Koble til backend</h1>
        <p className="mb-6 text-sm text-gray-400">
          Oppgi URL-en til Hotprevue-backend. Vanligvis{' '}
          <code className="rounded bg-gray-800 px-1 text-gray-300">http://localhost:8000</code>.
        </p>

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

        {status === 'ok' && (
          <p className="mt-3 text-sm text-green-400">Tilkoblet!</p>
        )}
        {status === 'error' && (
          <p className="mt-3 text-sm text-red-400">{errorMsg}</p>
        )}
      </div>
    </div>
  )
}
