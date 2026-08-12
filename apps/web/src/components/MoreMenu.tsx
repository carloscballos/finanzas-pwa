import { useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import './MoreMenu.css'

export interface MoreMenuItem {
  to: string
  label: string
  icon: LucideIcon
}

export function MoreMenu({
  items,
  open,
  onClose,
}: {
  items: MoreMenuItem[]
  open: boolean
  onClose: () => void
}) {
  useEffect(() => {
    if (!open) return
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <>
      <div className="more-menu-backdrop" onClick={onClose} />
      <div className="more-menu-panel" role="menu" aria-label="Más opciones">
        <div className="more-menu-handle" />
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            role="menuitem"
            onClick={onClose}
            className={({ isActive }) => `more-menu-item ${isActive ? 'active' : ''}`}
          >
            <item.icon size={18} strokeWidth={2} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>
    </>
  )
}
