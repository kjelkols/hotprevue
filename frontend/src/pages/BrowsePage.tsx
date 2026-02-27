import { useNavigate } from 'react-router-dom'
import PhotoGrid from '../features/browse/PhotoGrid'

export default function BrowsePage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="flex items-center gap-4 px-4 py-3 border-b border-gray-800">
        <button
          onClick={() => navigate('/')}
          className="text-sm text-gray-400 hover:text-white transition-colors"
        >
          ← Tilbake
        </button>
        <h1 className="text-xl font-semibold">Utvalg</h1>
      </div>

      <div className="p-4">
        <PhotoGrid />
      </div>
    </div>
  )
}
