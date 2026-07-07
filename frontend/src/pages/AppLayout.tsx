import { useRef } from 'react'
import { Outlet } from 'react-router-dom'
import TopNav from '../components/TopNav'
import PhotographerPicker from '../features/identity/PhotographerPicker'
import { useScrollRestoration } from '../hooks/useScrollRestoration'

// Rammen rundt alle vanlige sider: toppmeny + scroll-container for innholdet.
// All scrolling skjer i denne diven (ikke i vinduet), så scrollposisjonen
// gjenopprettes ved tilbakenavigasjon via useScrollRestoration.
export default function AppLayout() {
  const scrollRef = useRef<HTMLDivElement>(null)
  useScrollRestoration(scrollRef)

  return (
    <div className="h-screen flex flex-col bg-gray-950 text-white">
      <TopNav />
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto">
        <Outlet />
      </div>
      <PhotographerPicker />
    </div>
  )
}
