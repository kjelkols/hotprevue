import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getHomeStats } from '../api/stats'
import { listPhotos } from '../api/photos'
import HomeStatCards from '../features/home/HomeStatCards'
import HomePhotoMosaic from '../features/home/HomePhotoMosaic'
import HomePhotographerList from '../features/home/HomePhotographerList'

export default function HomePage() {
  const navigate = useNavigate()

  const { data: stats } = useQuery({
    queryKey: ['home-stats'],
    queryFn: getHomeStats,
  })

  const { data: randomPhotos = [] } = useQuery({
    queryKey: ['home-random-photos'],
    queryFn: () => listPhotos({ sort: 'random', limit: 8 }),
    staleTime: 0,
  })

  return (
    <div className="min-h-full bg-gray-950 text-white">
      <div className="max-w-3xl mx-auto px-6 py-12 flex flex-col items-center gap-10">

        {/* Hero */}
        <div className="flex flex-col items-center gap-4 text-center">
          <img src="/hotprevue-32.png" alt="" className="w-16 h-16 invert" />
          <div>
            <h1 className="text-3xl font-bold text-white leading-tight">Hotprevue</h1>
            <p className="text-gray-400 text-sm mt-1">
              Fotobibliotek — lokal indeks for bildene mine
            </p>
          </div>
        </div>

        {/* Stat cards */}
        {stats && (
          <div className="w-full">
            <HomeStatCards stats={stats} />
          </div>
        )}

        {/* Kollasj */}
        <HomePhotoMosaic photos={randomPhotos} />

        {/* Fotografer */}
        {stats && (
          <div className="w-full">
            <HomePhotographerList photographers={stats.photographers} />
          </div>
        )}

        {/* CTA */}
        <button
          onClick={() => navigate('/register')}
          className="rounded-xl bg-blue-600 px-8 py-3 text-sm font-semibold text-white shadow-lg hover:bg-blue-500 active:scale-95 transition-transform"
        >
          + Start ny registrering
        </button>

      </div>
    </div>
  )
}
