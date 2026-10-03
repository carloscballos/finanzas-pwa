import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  Home,
  Wallet,
  CreditCard,
  PiggyBank,
  Target,
  HandCoins,
  Landmark,
  Users,
  Mail,
  TrendingUp,
  MoreHorizontal,
  ChevronDown,
  Eye,
  EyeOff,
  Plus,
  Camera,
  Image as ImageIcon,
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { usePrivacy } from '../context/PrivacyContext'
import * as api from '../lib/api'
import { formatMoney } from '../lib/money'
import { MoreMenu, type MoreMenuItem } from './MoreMenu'
import { Fab, type FabAction } from './Fab'
import { UserMenu } from './UserMenu'
import { QuickTransactionModal } from './QuickTransactionModal'
import { Button } from './ui/Button'
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

const CARDS_ITEM: NavItem = { to: '/cards', label: 'Tarjetas', icon: CreditCard }

const SECONDARY_ITEMS: MoreMenuItem[] = [
  CARDS_ITEM,
  { to: '/debts', label: 'Deudas', icon: HandCoins },
  { to: '/loans', label: 'Préstamos', icon: Landmark },
  { to: '/friends', label: 'Amigos', icon: Users },
  { to: '/invitations', label: 'Invitaciones', icon: Mail },
  { to: '/forecast', label: 'Proyección', icon: TrendingUp },
]

// En el sidebar de escritorio (≥1024px) sí entran los 10 items en una sola
// columna, sin necesitar el overflow "Más" que sí hace falta en el header
// horizontal de mobile/tablet.
const ALL_NAV_ITEMS: NavItem[] = [
  ...PRIMARY_ITEMS.slice(0, 2),
  CARDS_ITEM,
  ...PRIMARY_ITEMS.slice(2),
  ...SECONDARY_ITEMS.slice(1),
]

export function Layout({
  children,
  fabActions = [],
  hideQuickTransaction = false,
}: {
  children: ReactNode
  fabActions?: FabAction[]
  /** La página de una cuenta ya tiene su propio "Nuevo movimiento" (con la cuenta conocida). */
  hideQuickTransaction?: boolean
}) {
  const { token } = useAuth()
  const { hideValues, toggleHideValues } = usePrivacy()
  const location = useLocation()
  const [usdRate, setUsdRate] = useState<number | null>(null)
  const [moreOpen, setMoreOpen] = useState(false)
  const [quickOpen, setQuickOpen] = useState(false)
  const [quickScanFile, setQuickScanFile] = useState<File | undefined>(undefined)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!token) return
    api
      .getExchangeRateUsdCop(token)
      .then((r) => setUsdRate(r.rate))
      .catch(() => setUsdRate(null))
  }, [token])

  function openQuick() {
    setQuickScanFile(undefined)
    setQuickOpen(true)
  }

  // El input de archivo se dispara dentro del toque del usuario (los navegadores
  // móviles bloquean abrirlo después de un render); la factura se lee ya en el modal.
  function handleQuickScanFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setQuickScanFile(file)
    setQuickOpen(true)
  }

  const allFabActions: FabAction[] = hideQuickTransaction
    ? fabActions
    : [
        { label: 'Nuevo movimiento', icon: Plus, onClick: openQuick },
        { label: 'Tomar foto de factura', icon: Camera, onClick: () => cameraInputRef.current?.click() },
        { label: 'Elegir imagen de factura', icon: ImageIcon, onClick: () => galleryInputRef.current?.click() },
        ...fabActions,
      ]

  const secondaryActive = SECONDARY_ITEMS.some((item) => item.to === location.pathname)

  return (
    <div className="layout">
      <aside className="layout-sidebar">
        <NavLink to="/" className="layout-sidebar-brand">
          Finanzas
        </NavLink>

        {!hideQuickTransaction && (
          <Button className="layout-sidebar-quick" onClick={openQuick}>
            <Plus size={16} /> Nuevo movimiento
          </Button>
        )}

        <nav className="layout-sidebar-nav" aria-label="Navegación principal">
          {ALL_NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => `layout-sidebar-link ${isActive ? 'active' : ''}`}
            >
              <item.icon size={18} strokeWidth={2} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="layout-sidebar-footer">
          <button
            type="button"
            className="layout-sidebar-privacy"
            onClick={toggleHideValues}
            title={hideValues ? 'Mostrar valores' : 'Ocultar valores'}
          >
            {hideValues ? <EyeOff size={16} /> : <Eye size={16} />}
            {hideValues ? 'Mostrar valores' : 'Ocultar valores'}
          </button>
          {usdRate !== null && (
            <div
              className="layout-sidebar-rate"
              title="Tasa de cambio USD/COP (TRM oficial del Banco de la República)"
            >
              1 USD = {formatMoney(Math.round(usdRate), 'COP')}
            </div>
          )}
          <UserMenu placement="up" block />
        </div>
      </aside>

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

          <div className="layout-user">
            {!hideQuickTransaction && (
              <button
                type="button"
                className="layout-privacy-toggle layout-quick-header-btn"
                onClick={openQuick}
                title="Nuevo movimiento"
                aria-label="Nuevo movimiento"
              >
                <Plus size={18} />
              </button>
            )}
            <button
              type="button"
              className="layout-privacy-toggle"
              onClick={toggleHideValues}
              title={hideValues ? 'Mostrar valores' : 'Ocultar valores'}
              aria-label={hideValues ? 'Mostrar valores' : 'Ocultar valores'}
            >
              {hideValues ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
            {usdRate !== null && (
              <span
                className="layout-usd-rate"
                title="Tasa de cambio USD/COP (TRM oficial del Banco de la República)"
              >
                1 USD = {formatMoney(Math.round(usdRate), 'COP')}
              </span>
            )}
            <UserMenu placement="down" usdRate={usdRate} />
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

      <Fab actions={allFabActions} />

      {!hideQuickTransaction && (
        <>
          <input ref={cameraInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" capture="environment" hidden onChange={handleQuickScanFile} />
          <input ref={galleryInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={handleQuickScanFile} />
        </>
      )}

      <QuickTransactionModal open={quickOpen} onClose={() => setQuickOpen(false)} scanFile={quickScanFile} />
    </div>
  )
}
