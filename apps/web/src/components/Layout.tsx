import { useEffect, useState, type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import * as api from '../lib/api'
import { formatMoney } from '../lib/money'
import './Layout.css'

const NAV_ITEMS = [
  { to: '/', label: 'Inicio' },
  { to: '/accounts', label: 'Cuentas' },
  { to: '/categories', label: 'Categorías' },
  { to: '/budgets', label: 'Presupuestos' },
  { to: '/goals', label: 'Metas' },
  { to: '/debts', label: 'Deudas' },
  { to: '/friends', label: 'Amigos' },
  { to: '/invitations', label: 'Invitaciones' },
  { to: '/forecast', label: 'Proyección' },
]

export function Layout({ children }: { children: ReactNode }) {
  const { user, token, logout } = useAuth()
  const [usdRate, setUsdRate] = useState<number | null>(null)

  useEffect(() => {
    if (!token) return
    api
      .getExchangeRateUsdCop(token)
      .then((r) => setUsdRate(r.rate))
      .catch(() => setUsdRate(null))
  }, [token])

  return (
    <div className="layout">
      <header className="layout-header">
        <span className="layout-brand">Finanzas</span>
        <nav className="layout-nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => `layout-nav-link ${isActive ? 'active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="layout-user">
          {usdRate !== null && (
            <span className="layout-usd-rate" title="Tasa de cambio USD/COP (TRM oficial del Banco de la República)">
              1 USD = {formatMoney(Math.round(usdRate), 'COP')}
            </span>
          )}
          <span>{user?.name}</span>
          <button className="btn btn-secondary" onClick={logout}>
            Salir
          </button>
        </div>
      </header>
      <main className="layout-content">{children}</main>
    </div>
  )
}
