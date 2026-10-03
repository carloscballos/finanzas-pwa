import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BellRing, ChevronDown, ChevronRight, KeyRound, LogOut, Mail, Moon, Settings, Sun, Tags, type LucideIcon } from 'lucide-react'
import { Modal } from './ui/Modal'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { formatMoney } from '../lib/money'
import './UserMenu.css'

/**
 * Menú del usuario (avatar + nombre): cambiar tema, Configuración y Salir.
 * Lo comparten el menú lateral (se abre hacia arriba) y el encabezado (hacia abajo).
 *
 * Configuración abre una lista de opciones (cosas que se configuran una vez y
 * después casi no se visitan, por eso no van en el menú principal) y cada una
 * lleva a su página. Para sumar otra, agregarla a SETTINGS_OPTIONS.
 */
const SETTINGS_OPTIONS: { to: string; icon: LucideIcon; title: string; description: string }[] = [
  {
    to: '/categories',
    icon: Tags,
    title: 'Categorías',
    description: 'Organiza tus gastos e ingresos',
  },
  {
    to: '/invitations',
    icon: Mail,
    title: 'Invitaciones',
    description: 'Cuentas compartidas a las que te invitaron',
  },
  {
    to: '/settings/notifications',
    icon: BellRing,
    title: 'Notificaciones',
    description: 'Activa los avisos push en este dispositivo',
  },
  {
    to: '/settings',
    icon: KeyRound,
    title: 'Código de acceso (token)',
    description: 'Para conectar atajos, como el de Apple Wallet',
  },
]

export function UserMenu({
  placement = 'down',
  block = false,
  usdRate = null,
}: {
  placement?: 'up' | 'down'
  /** Botón de ancho completo (menú lateral). */
  block?: boolean
  usdRate?: number | null
}) {
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false)
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  const themeLabel = theme === 'dark' ? 'Tema claro' : 'Tema oscuro'

  return (
    <div className={`user-menu ${block ? 'user-menu-block' : ''}`} ref={rootRef}>
      <button
        type="button"
        className="user-menu-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="user-menu-avatar">{user?.name?.[0]?.toUpperCase() ?? '?'}</span>
        <span className="user-menu-name">{user?.name}</span>
        <ChevronDown size={14} className={`user-menu-chevron ${open ? 'open' : ''}`} />
      </button>

      {open && (
        <div className={`user-menu-popup user-menu-popup-${placement}`} role="menu">
          <div className="user-menu-popup-name">{user?.name}</div>
          {usdRate !== null && (
            <div className="user-menu-popup-rate">1 USD = {formatMoney(Math.round(usdRate), 'COP')}</div>
          )}
          <button
            type="button"
            role="menuitem"
            className="user-menu-item"
            onClick={() => {
              toggleTheme()
              setOpen(false)
            }}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            {themeLabel}
          </button>
          <button
            type="button"
            role="menuitem"
            className="user-menu-item"
            onClick={() => {
              setOpen(false)
              setSettingsOpen(true)
            }}
          >
            <Settings size={16} />
            Configuración
          </button>
          <button type="button" role="menuitem" className="user-menu-item user-menu-item-danger" onClick={logout}>
            <LogOut size={16} />
            Salir
          </button>
        </div>
      )}

      <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)} title="Configuración">
        <div className="settings-options">
          {SETTINGS_OPTIONS.map((option) => (
            <button
              key={option.to}
              type="button"
              className="settings-option"
              onClick={() => {
                setSettingsOpen(false)
                navigate(option.to)
              }}
            >
              <span className="settings-option-icon">
                <option.icon size={18} />
              </span>
              <span className="settings-option-text">
                <strong>{option.title}</strong>
                <small>{option.description}</small>
              </span>
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          ))}
        </div>
      </Modal>
    </div>
  )
}
