import { useState, useEffect } from 'react'
import { NavLink, Link, useLocation } from 'react-router-dom'

const NAV = [
  { to: '/timeline',    label: 'Tidslinje',    end: false },
  { to: '/events',      label: 'Events',       end: false },
  { to: '/collections', label: 'Kolleksjoner', end: false },
  { to: '/sessions',    label: 'Sesjoner',     end: false },
  { to: '/searches',    label: 'Søk',          end: false },
  { to: '/ai-search',   label: 'AI-søk',       end: false },
  { to: '/sted',        label: 'Sted',         end: false },
  { to: '/fotografer',  label: 'Fotografer',   end: false },
  { to: '/kinds',       label: 'Kinds',        end: false },
] as const

const EXTRA_NAV = [
  { to: '/preorganisering', label: 'Lokale verktøy' },
  { to: '/settings',        label: 'Innstillinger' },
] as const

export default function TopNav() {
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  // Close menu on navigation
  useEffect(() => { setMenuOpen(false) }, [location.pathname])

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    'px-3 py-1.5 rounded text-sm transition-colors ' +
    (isActive ? 'bg-gray-700 text-white' : 'text-gray-300 hover:text-white hover:bg-gray-800')

  return (
    <div className="relative shrink-0 z-40">
      <nav className="flex items-center h-11 px-3 bg-gray-900 border-b border-gray-800 gap-1">
        <Link to="/" className="flex items-center gap-2 px-2 mr-2 shrink-0 hover:opacity-80 transition-opacity">
          <img src="/hotprevue-32.png" alt="" className="w-6 h-6 invert" />
          <span className="text-sm font-semibold text-white">Hotprevue</span>
          {import.meta.env.VITE_BUILD_NUMBER && (
            <span className="text-xs text-gray-500 font-mono">#{import.meta.env.VITE_BUILD_NUMBER}</span>
          )}
        </Link>

        {/* Desktop nav */}
        <div className="hidden lg:flex items-center gap-1 flex-1">
          {NAV.map(({ to, label, end }) => (
            <NavLink key={to} to={to} end={end} className={navLinkClass}>{label}</NavLink>
          ))}
          <div className="ml-auto flex items-center gap-1">
            {EXTRA_NAV.map(({ to, label }) => (
              <NavLink key={to} to={to} className={navLinkClass}>{label}</NavLink>
            ))}
          </div>
        </div>

        {/* Mobile hamburger */}
        <button
          className="lg:hidden ml-auto p-2 text-gray-300 hover:text-white transition-colors"
          onClick={() => setMenuOpen(v => !v)}
          aria-label="Meny"
        >
          {menuOpen ? '✕' : '☰'}
        </button>
      </nav>

      {/* Mobile dropdown */}
      {menuOpen && (
        <>
          <div className="lg:hidden fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
          <div className="lg:hidden absolute top-full left-0 right-0 z-50 bg-gray-900 border-b border-gray-800 shadow-xl">
            {[...NAV, ...EXTRA_NAV].map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  'block px-4 py-3 text-sm border-b border-gray-800 transition-colors ' +
                  (isActive ? 'bg-gray-700 text-white' : 'text-gray-300 hover:text-white hover:bg-gray-800')
                }
              >
                {label}
              </NavLink>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
