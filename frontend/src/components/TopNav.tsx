import { NavLink, Link } from 'react-router-dom'

const NAV = [
  { to: '/browse',      label: 'Utvalg',        end: true  },
  { to: '/events',      label: 'Events',         end: false },
  { to: '/collections', label: 'Kolleksjoner',   end: false },
  { to: '/sessions',    label: 'Sesjoner',       end: false },
] as const

export default function TopNav() {
  return (
    <nav className="shrink-0 flex items-center h-11 px-3 bg-gray-900 border-b border-gray-800 gap-1">
      <Link to="/" className="text-sm font-semibold text-white px-2 mr-2 shrink-0 hover:text-gray-300 transition-colors">
        Hotprevue
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
    </nav>
  )
}
