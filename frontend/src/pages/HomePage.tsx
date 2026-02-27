import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import RegistrationFlow from '../features/registration/RegistrationFlow'

export default function HomePage() {
  const [registering, setRegistering] = useState(false)
  const navigate = useNavigate()

  if (registering) {
    return <RegistrationFlow onClose={() => setRegistering(false)} />
  }

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-gray-950">
      <h1 className="mb-2 text-4xl font-bold text-white">Hotprevue</h1>
      <p className="mb-10 text-gray-400">Fotobibliotek — enkel bruker, ingen innlogging</p>

      <div className="flex flex-col gap-3 w-72">
        <button
          onClick={() => setRegistering(true)}
          className="rounded-xl bg-blue-600 px-8 py-4 text-lg font-semibold text-white shadow-lg hover:bg-blue-500 active:scale-95 transition-transform"
        >
          Start ny registrering
        </button>

        <div className="h-px bg-gray-800 my-1" />

        <button
          onClick={() => navigate('/sessions')}
          className="rounded-xl bg-gray-700 px-8 py-4 text-lg font-semibold text-white shadow-lg hover:bg-gray-600 active:scale-95 transition-transform"
        >
          Registreringssesjoner →
        </button>

        <button
          onClick={() => navigate('/events')}
          className="rounded-xl bg-gray-700 px-8 py-4 text-lg font-semibold text-white shadow-lg hover:bg-gray-600 active:scale-95 transition-transform"
        >
          Events →
        </button>

        <button
          onClick={() => navigate('/browse')}
          className="rounded-xl bg-gray-700 px-8 py-4 text-lg font-semibold text-white shadow-lg hover:bg-gray-600 active:scale-95 transition-transform"
        >
          Alle bilder →
        </button>

        <button
          onClick={() => navigate('/collections')}
          className="rounded-xl bg-gray-700 px-8 py-4 text-lg font-semibold text-white shadow-lg hover:bg-gray-600 active:scale-95 transition-transform"
        >
          Kolleksjoner →
        </button>
      </div>
    </div>
  )
}
