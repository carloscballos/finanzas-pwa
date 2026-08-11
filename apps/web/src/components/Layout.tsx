import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './Layout.css'

const NAV_ITEMS = [
  { to: '/accounts', label: 'Cuentas' },
  { to: '/categories', label: 'Categorías' },
  { to: '/budgets', label: 'Presupuestos' },
  { to: '/goals', label: 'Metas' },
  { to: '/debts', label: 'Deudas' },
  { to: '/invitations', label: 'Invitaciones' },
  { to: '/forecast', label: 'Proyección' },
]

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth()

  return (
    <div className="layout">
      <header className="layout-header">
        <span className="layout-brand">Finanzas</span>
        <nav className="layout-nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `layout-nav-link ${isActive ? 'active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="layout-user">
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
