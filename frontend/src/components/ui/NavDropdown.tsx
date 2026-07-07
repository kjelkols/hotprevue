import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Link, useLocation } from 'react-router-dom'

export interface NavDropdownItem {
  to: string
  label: string
}

interface Props {
  label: string
  items: NavDropdownItem[]
}

/**
 * Grupperer flere ruter bak én knapp i TopNav (Radix DropdownMenu — riktig
 * primitiv for menysemantikk: piltast-navigasjon, Escape lukker, fokus
 * fanges korrekt). Knappen fremheves når en av rutene i gruppen er aktiv,
 * slik at brukeren ser hvilken gruppe man befinner seg i uten å åpne den.
 */
export default function NavDropdown({ label, items }: Props) {
  const location = useLocation()
  const isActive = items.some(item => location.pathname.startsWith(item.to))

  const triggerClass =
    'flex items-center gap-1 px-3 py-1.5 rounded text-sm transition-colors outline-none ' +
    (isActive ? 'bg-gray-700 text-white' : 'text-gray-300 hover:text-white hover:bg-gray-800')

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className={triggerClass}>
        {label}
        <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={4}
          className="bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 py-1 min-w-[160px]"
        >
          {items.map(item => {
            const itemActive = location.pathname.startsWith(item.to)
            return (
              <DropdownMenu.Item key={item.to} asChild>
                <Link
                  to={item.to}
                  className={`block w-full text-left px-3 py-1.5 text-sm outline-none transition-colors ${
                    itemActive ? 'text-white bg-gray-700' : 'text-gray-300 hover:text-white hover:bg-gray-700'
                  }`}
                >
                  {item.label}
                </Link>
              </DropdownMenu.Item>
            )
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
