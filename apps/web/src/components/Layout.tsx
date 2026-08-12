import { useEffect, useRef, useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  Home,
  Wallet,
  PiggyBank,
  Target,
  Tags,
  HandCoins,
  Users,
  Mail,
  TrendingUp,
  MoreHorizontal,
  ChevronDown,
  LogOut,
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import * as api from '../lib/api'
import { formatMoney } from '../lib/money'
import { MoreMenu, type MoreMenuItem } from './MoreMenu'
import { Fab, type FabAction } from './Fab'
import './Layout.css'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
}

const PRIMARY_ITEMS: NavItem[] = [
  { to: '/', label: 'Inicio', icon: Home },
  { to: '/accounts', label: 'Cuentas', icon: Wallet },
  { to: '/budgets', label: 'Presupuestos', icon: PiggyBank },
  { to: '/goals', label: 'Metas', icon: Target },
]

const SECONDARY_ITEMS: MoreMenuItem[] = [
  { to: '/categories', label: 'Categorías', icon: Tags },
  { to: '/debts', label: 'Deudas', icon: HandCoins },
  { to: '/friends', label: 'Amigos', icon: Users },
  { to: '/invitations', label: 'Invitaciones', icon: Mail },
  { to: '/forecast', label: 'Proyección', icon: TrendingUp },
]

export function Layout({
  children,
  fabActions = [],
}: {
  children: ReactNode
  fabActions?: FabAction[]
}) {
  const { user, token, logout } = useAuth()
  const location = useLocation()
  const [usdRate, setUsdRate] = useState<number | null>(null)
  const [moreOpen, setMoreOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!token) return
    api
      .getExchangeRateUsdCop(token)
      .then((r) => setUsdRate(r.rate))
      .catch(() => setUsdRate(null))
  }, [token])

  useEffect(() => {
    if (!userMenuOpen) return
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [userMenuOpen])

  const secondaryActive = SECONDARY_ITEMS.some((item) => item.to === location.pathname)

  return (
    <div className="layout">
      <header className="layout-header">
        <div className="layout-header-inner page">
          <NavLink to="/" className="layout-brand">
            Finanzas
          </NavLink>

          <nav className="layout-nav-desktop" aria-label="Navegación principal">
            {PRIMARY_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) => `layout-nav-link ${isActive ? 'active' : ''}`}
                title={item.label}
              >
                <item.icon size={16} strokeWidth={2} />
                <span className="layout-nav-label">{item.label}</span>
              </NavLink>
            ))}
            <button
              type="button"
              className={`layout-nav-link layout-more-trigger ${secondaryActive ? 'active' : ''}`}
              onClick={() => setMoreOpen((v) => !v)}
              aria-expanded={moreOpen}
              title="Más opciones"
            >
              <MoreHorizontal size={16} strokeWidth={2} />
              <span className="layout-nav-label">Más</span>
              <ChevronDown size={14} className={`layout-chevron ${moreOpen ? 'open' : ''}`} />
            </button>
          </nav>

          <div className="layout-user" ref={userMenuRef}>
            {usdRate !== null && (
              <span
                className="layout-usd-rate"
                title="Tasa de cambio USD/COP (TRM oficial del Banco de la República)"
              >
                1 USD = {formatMoney(Math.round(usdRate), 'COP')}
              </span>
            )}
            <button
              type="button"
              className="layout-user-trigger"
              onClick={() => setUserMenuOpen((v) => !v)}
              aria-expanded={userMenuOpen}
            >
              <span className="layout-user-avatar">{user?.name?.[0]?.toUpperCase() ?? '?'}</span>
              <span className="layout-user-name">{user?.name}</span>
              <ChevronDown size={14} className={`layout-chevron ${userMenuOpen ? 'open' : ''}`} />
            </button>
            {userMenuOpen && (
              <div className="layout-user-menu">
                <div className="layout-user-menu-name">{user?.name}</div>
                {usdRate !== null && (
                  <div className="layout-user-menu-rate">
                    1 USD = {formatMoney(Math.round(usdRate), 'COP')}
                  </div>
                )}
                <button className="layout-user-menu-logout" onClick={logout}>
                  <LogOut size={16} />
                  Salir
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="layout-content">
        <div className="page">{children}</div>
      </main>

      <nav className="layout-bottom-nav" aria-label="Navegación">
        {PRIMARY_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => `layout-bottom-nav-item ${isActive ? 'active' : ''}`}
          >
            <item.icon size={20} strokeWidth={2} />
            <span>{item.label}</span>
          </NavLink>
        ))}
        <button
          type="button"
          className={`layout-bottom-nav-item ${secondaryActive || moreOpen ? 'active' : ''}`}
          onClick={() => setMoreOpen((v) => !v)}
          aria-expanded={moreOpen}
        >
          <MoreHorizontal size={20} strokeWidth={2} />
          <span>Más</span>
        </button>
      </nav>

      <MoreMenu items={SECONDARY_ITEMS} open={moreOpen} onClose={() => setMoreOpen(false)} />

      <Fab actions={fabActions} />
    </div>
  )
}
