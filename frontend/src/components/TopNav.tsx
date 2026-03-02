import { NavLink, Link } from 'react-router-dom'

const NAV = [
  { to: '/events',      label: 'Events',         end: false },
  { to: '/collections', label: 'Kolleksjoner',   end: false },
  { to: '/sessions',    label: 'Sesjoner',       end: false },
  { to: '/tags',        label: 'Tags',           end: false },
  { to: '/searches',    label: 'Søk',            end: false },
] as const

export default function TopNav() {
  return (
    <nav className="shrink-0 flex items-center h-11 px-3 bg-gray-900 border-b border-gray-800 gap-1">
      <Link to="/" className="flex items-center gap-2 px-2 mr-2 shrink-0 hover:opacity-80 transition-opacity">
        <img src="/hotprevue-32.png" alt="" className="w-6 h-6" />
        <span className="text-sm font-semibold text-white">Hotprevue</span>
      </Link>
      {NAV.map(({ to, label, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            'px-3 py-1.5 rounded text-sm transition-colors ' +
            (isActive ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800')
          }
        >
          {label}
        </NavLink>
      ))}
      <div className="ml-auto">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            'px-3 py-1.5 rounded text-sm transition-colors ' +
            (isActive ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800')
          }
        >
          Innstillinger
        </NavLink>
      </div>
    </nav>
  )
}
