import { useState } from 'react'
import RegistrationFlow from '../features/registration/RegistrationFlow'

export default function HomePage() {
  const [registering, setRegistering] = useState(false)

  if (registering) {
    return <RegistrationFlow onClose={() => setRegistering(false)} />
  }

  return (
    <div className="flex h-full flex-col items-center justify-center">
      <h1 className="mb-2 text-4xl font-bold text-white">Hotprevue</h1>
      <p className="mb-10 text-gray-400">Fotobibliotek — enkel bruker, ingen innlogging</p>
      <button
        onClick={() => setRegistering(true)}
        className="rounded-xl bg-blue-600 px-8 py-4 text-lg font-semibold text-white shadow-lg hover:bg-blue-500 active:scale-95 transition-transform"
      >
        Start ny registrering
      </button>
    </div>
  )
}
