import { useState, useEffect } from 'react'
import { NavLink, Link, useLocation } from 'react-router-dom'
import NavDropdown, { type NavDropdownItem } from './ui/NavDropdown'

// Direkte lenker — de tre mest brukte sidene, ett klikk unna.
const PRIMARY = [
  { to: '/timeline',    label: 'Tidslinje' },
  { to: '/events',      label: 'Events' },
  { to: '/collections', label: 'Kolleksjoner' },
] as const

const SEARCH_GROUP: NavDropdownItem[] = [
  { to: '/searches',  label: 'Søk' },
  { to: '/ai-search', label: 'AI-søk' },
]

const ORGANISE_GROUP: NavDropdownItem[] = [
  { to: '/fotografer', label: 'Fotografer' },
  { to: '/tags',       label: 'Tags' },
  { to: '/kinds',      label: 'Kinds' },
  { to: '/sted',       label: 'Sted' },
  { to: '/maskiner',   label: 'Maskiner' },
]

// Sesjoner er en passiv oversikt — leser kun sesjonshistorikk fra backend
// og lar deg browse videre til /browse. Krever ikke den lokale agenten,
// så den får normal (ikke dempet) styling, i motsetning til klyngen under.
const SESSIONS_LINK = { to: '/sessions', label: 'Sesjoner' } as const

// Aktivt registreringsarbeid — krever den lokale agenten (client/agent) for
// filsystemtilgang og bildeprosessering. Vises visuelt dempet og skilt ut
// med en vertikal linje. Kandidat for å flytte til en egen "uploader"-app
// (se docs/vision/tilgang-og-deling.md).
const UPLOADER_CLUSTER = [
  { to: '/register',        label: 'Registrer' },
  { to: '/preorganisering', label: 'Lokale verktøy' },
] as const

const SETTINGS = { to: '/settings', label: 'Innstillinger' } as const

// Flat liste for mobilmenyen, med seksjonsoverskrifter — på mobil er det
// ikke plass til nedtrekksmenyer, så gruppene vises som egne avsnitt i
// stedet for som dropdowns.
const MOBILE_SECTIONS: { heading: string | null; items: readonly { to: string; label: string }[] }[] = [
  { heading: null, items: PRIMARY },
  { heading: 'Søk', items: SEARCH_GROUP },
  { heading: 'Organisering', items: ORGANISE_GROUP },
  { heading: 'Registreringer', items: [SESSIONS_LINK, ...UPLOADER_CLUSTER] },
  { heading: null, items: [SETTINGS] },
]

export default function TopNav() {
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  // Close menu on navigation
  useEffect(() => { setMenuOpen(false) }, [location.pathname])

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    'px-3 py-1.5 rounded text-sm transition-colors ' +
    (isActive ? 'bg-gray-700 text-white' : 'text-gray-300 hover:text-white hover:bg-gray-800')

  const uploaderLinkClass = ({ isActive }: { isActive: boolean }) =>
    'px-3 py-1.5 rounded text-sm transition-colors ' +
    (isActive ? 'bg-gray-800 text-gray-200' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/60')

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
          {PRIMARY.map(({ to, label }) => (
            <NavLink key={to} to={to} className={navLinkClass}>{label}</NavLink>
          ))}
          <NavDropdown label="Søk" items={SEARCH_GROUP} />
          <NavDropdown label="Organisering" items={ORGANISE_GROUP} />

          <div className="ml-auto flex items-center gap-1">
            <NavLink to={SESSIONS_LINK.to} className={navLinkClass}>{SESSIONS_LINK.label}</NavLink>
            <div className="flex items-center gap-1 pl-1 pr-2 border-r border-gray-800">
              {UPLOADER_CLUSTER.map(({ to, label }) => (
                <NavLink key={to} to={to} className={uploaderLinkClass}>{label}</NavLink>
              ))}
            </div>
            <NavLink to={SETTINGS.to} className={navLinkClass}>{SETTINGS.label}</NavLink>
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
          <div className="lg:hidden absolute top-full left-0 right-0 z-50 bg-gray-900 border-b border-gray-800 shadow-xl max-h-[80vh] overflow-y-auto">
            {MOBILE_SECTIONS.map((section, i) => (
              <div key={i}>
                {section.heading && (
                  <div className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {section.heading}
                  </div>
                )}
                {section.items.map(({ to, label }) => (
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
            ))}
          </div>
        </>
      )}
    </div>
  )
}
