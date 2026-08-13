import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  Wallet,
  Receipt,
  Target,
  PiggyBank,
  Landmark,
  TrendingUp,
} from 'lucide-react'
import { Layout } from '../components/Layout'
import { useAuth } from '../context/AuthContext'
import * as api from '../lib/api'
import {
  ApiError,
  type Account,
  type Budget,
  type Debt,
  type ForecastSummary,
  type FriendRequest,
  type Goal,
  type Invitation,
  type Transaction,
} from '../lib/api'
import { formatMoney } from '../lib/money'
import './HomePage.css'

const RECENT_TRANSACTIONS_LIMIT = 8
const BUDGET_RISK_THRESHOLD = 70

function formatDate(iso: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(iso))
}

function sumByCurrency(amounts: { amount: number; currency: string }[]): Record<string, number> {
  const totals: Record<string, number> = {}
  for (const { amount, currency } of amounts) {
    totals[currency] = (totals[currency] ?? 0) + amount
  }
  return totals
}

// Mismo criterio de "mes calendario" que el backend usa para presupuestos
// (ver period-window.util.ts) — UTC, para que el rango coincida con
// occurredAt tal cual se guarda.
function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

function addMonths(date: Date, delta: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + delta, 1))
}

function formatMonthLabel(date: Date): string {
  const label = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    date,
  )
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function HomePage() {
  const { user, token } = useAuth()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [debts, setDebts] = useState<Debt[]>([])
  const [forecast, setForecast] = useState<ForecastSummary[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [monthStart, setMonthStart] = useState(() => startOfMonth(new Date()))

  const monthEnd = addMonths(monthStart, 1)
  const isCurrentMonth = monthStart.getTime() === startOfMonth(new Date()).getTime()

  useEffect(() => {
    if (!token) return
    setLoading(true)
    Promise.all([
      api.getAccounts(token),
      api.getTransactions(token, { startDate: monthStart.toISOString(), endDate: monthEnd.toISOString() }),
      api.getBudgets(token),
      api.getGoals(token),
      api.getDebts(token),
      api.getForecastSummary(token),
      api.getMyInvitations(token),
      api.getReceivedFriendRequests(token),
    ])
      .then(([accs, txs, bud, gls, dbts, fc, invs, freqs]) => {
        setAccounts(accs)
        setTransactions(txs)
        setBudgets(bud)
        setGoals(gls)
        setDebts(dbts)
        setForecast(fc)
        setInvitations(invs.filter((i) => i.status === 'PENDING'))
        setFriendRequests(freqs)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Error al cargar el resumen'))
      .finally(() => setLoading(false))
  }, [token, monthStart])

  const personalAccounts = accounts.filter((a) => a.memberCount <= 1)
  const sharedAccounts = accounts.filter((a) => a.memberCount > 1)
  const personalBalancesByCurrency = sumByCurrency(
    personalAccounts.map((a) => ({ amount: a.currentBalance, currency: a.currency })),
  )
  const sharedBalancesByCurrency = sumByCurrency(
    sharedAccounts.map((a) => ({ amount: a.currentBalance, currency: a.currency })),
  )
  const budgetsAtRisk = budgets
    .filter((b) => b.percentUsed >= BUDGET_RISK_THRESHOLD)
    .sort((a, b) => b.percentUsed - a.percentUsed)
  const pendingDebts = debts.filter((d) => d.status !== 'SETTLED')
  const owedToMe = sumByCurrency(
    pendingDebts.filter((d) => d.direction === 'THEY_OWE_ME').map((d) => ({ amount: d.amount, currency: d.currency })),
  )
  const owedByMe = sumByCurrency(
    pendingDebts.filter((d) => d.direction === 'I_OWE_THEM').map((d) => ({ amount: d.amount, currency: d.currency })),
  )
  // transferId se excluye de estos totales: mover dinero entre tus propias
  // cuentas no es ingreso ni gasto real, solo reubicación.
  const monthFlows = transactions.filter((tx) => !tx.transferId)
  const monthIncomeByCurrency = sumByCurrency(
    monthFlows.filter((tx) => tx.type === 'INCOME').map((tx) => ({ amount: tx.amount, currency: tx.account.currency })),
  )
  const monthExpenseByCurrency = sumByCurrency(
    monthFlows.filter((tx) => tx.type === 'EXPENSE').map((tx) => ({ amount: tx.amount, currency: tx.account.currency })),
  )
  const monthCurrencies = Array.from(new Set([...Object.keys(monthIncomeByCurrency), ...Object.keys(monthExpenseByCurrency)]))
  const recentTransactions = transactions.slice(0, RECENT_TRANSACTIONS_LIMIT)
  const pendingRequestsCount = invitations.length + friendRequests.length
  const newTransactionHref = accounts.length === 1 ? `/accounts/${accounts[0].id}/transactions?new=1` : '/accounts'

  const quickActions = [
    { to: '/accounts?new=1', label: 'Nueva cuenta', icon: Wallet },
    { to: newTransactionHref, label: 'Nuevo movimiento', icon: Receipt },
    { to: '/goals?new=1', label: 'Nueva meta', icon: Target },
    { to: '/budgets?new=1', label: 'Nuevo presupuesto', icon: PiggyBank },
    { to: '/loans?new=1', label: 'Nuevo préstamo', icon: Landmark },
    { to: '/forecast', label: 'Ver proyección', icon: TrendingUp },
  ]

  return (
    <Layout>
      <h1>Hola, {user?.name?.split(' ')[0]}</h1>

      <div className="home-quick-actions">
        {quickActions.map((action) => (
          <Link className="home-quick-action" to={action.to} key={action.label}>
            <action.icon size={18} strokeWidth={2} />
            <span>{action.label}</span>
          </Link>
        ))}
      </div>

      {loading && <p>Cargando…</p>}
      {error && <div className="auth-error">{error}</div>}

      {!loading && !error && (
        <>
          <div className="home-month-nav">
            <button
              type="button"
              className="home-month-nav-btn"
              onClick={() => setMonthStart((m) => addMonths(m, -1))}
              aria-label="Mes anterior"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="home-month-label">{formatMonthLabel(monthStart)}</span>
            <button
              type="button"
              className="home-month-nav-btn"
              onClick={() => setMonthStart((m) => addMonths(m, 1))}
              aria-label="Mes siguiente"
            >
              <ChevronRight size={18} />
            </button>
            {!isCurrentMonth && (
              <button type="button" className="home-month-reset" onClick={() => setMonthStart(startOfMonth(new Date()))}>
                Mes actual
              </button>
            )}
          </div>

          <section className="home-section">
            <h2>Saldo total</h2>
            {accounts.length === 0 ? (
              <p className="accounts-empty">Todavía no tienes cuentas — créalas en Cuentas.</p>
            ) : (
              <>
                {personalAccounts.length > 0 && (
                  <div className="home-balance-group">
                    <div className="home-balance-group-label">Cuentas personales</div>
                    <div className="home-stat-cards">
                      {Object.entries(personalBalancesByCurrency).map(([currency, total]) => (
                        <div className="home-stat-card" key={currency}>
                          <div className="home-stat-currency">{currency}</div>
                          <div className={`home-stat-amount ${total < 0 ? 'negative' : ''}`}>
                            {formatMoney(total, currency)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {sharedAccounts.length > 0 && (
                  <div className="home-balance-group">
                    <div className="home-balance-group-label">Cuentas compartidas</div>
                    <div className="home-stat-cards">
                      {Object.entries(sharedBalancesByCurrency).map(([currency, total]) => (
                        <div className="home-stat-card" key={currency}>
                          <div className="home-stat-currency">{currency}</div>
                          <div className={`home-stat-amount ${total < 0 ? 'negative' : ''}`}>
                            {formatMoney(total, currency)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </section>

          {monthCurrencies.length > 0 && (
            <section className="home-section">
              <h2>Resumen de {formatMonthLabel(monthStart)}</h2>
              <div className="home-stat-cards">
                {monthCurrencies.map((currency) => {
                  const income = monthIncomeByCurrency[currency] ?? 0
                  const expense = monthExpenseByCurrency[currency] ?? 0
                  return (
                    <div className="home-stat-card" key={currency}>
                      <div className="home-stat-currency">{currency}</div>
                      <div className={`home-stat-amount ${income - expense < 0 ? 'negative' : 'income'}`}>
                        {formatMoney(income - expense, currency)}
                      </div>
                      <div className="home-stat-sub">
                        +{formatMoney(income, currency)} / -{formatMoney(expense, currency)}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {pendingRequestsCount > 0 && (
            <section className="home-section">
              <h2>Solicitudes pendientes</h2>
              <div className="home-requests-list">
                {invitations.map((inv) => (
                  <Link className="home-request-row" to="/invitations" key={`inv-${inv.id}`}>
                    <span>
                      Invitación a <strong>{inv.account.name}</strong> de {inv.invitedBy.name}
                    </span>
                    <span className="badge badge-warn">Ver</span>
                  </Link>
                ))}
                {friendRequests.map((r) => (
                  <Link className="home-request-row" to="/friends" key={`fr-${r.id}`}>
                    <span>
                      Solicitud de amistad de <strong>{r.requestedBy.name}</strong>
                    </span>
                    <span className="badge badge-warn">Ver</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {forecast.length > 0 && (
            <section className="home-section">
              <div className="home-section-header">
                <h2>Proyección mensual</h2>
                <Link to="/forecast">Ver detalle →</Link>
              </div>
              <div className="home-stat-cards">
                {forecast.map((f) => (
                  <div className="home-stat-card" key={f.currency}>
                    <div className="home-stat-currency">{f.currency}</div>
                    <div className={`home-stat-amount ${f.projectedMonthlyNet < 0 ? 'negative' : ''}`}>
                      {formatMoney(f.projectedMonthlyNet, f.currency)}
                    </div>
                    <div className="home-stat-sub">
                      +{formatMoney(f.projectedMonthlyIncome, f.currency)} / -
                      {formatMoney(f.projectedMonthlyExpense, f.currency)}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {budgetsAtRisk.length > 0 && (
            <section className="home-section">
              <div className="home-section-header">
                <h2>Presupuestos en riesgo</h2>
                <Link to="/budgets">Ver todos →</Link>
              </div>
              <div className="home-list">
                {budgetsAtRisk.map((b) => (
                  <div className="home-list-row" key={b.id}>
                    <span>
                      {b.category.emoji ? `${b.category.emoji} ` : ''}
                      {b.category.name}
                    </span>
                    <span className={`badge ${b.percentUsed >= 100 ? 'badge-error' : 'badge-warn'}`}>
                      {b.percentUsed}% usado
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {goals.length > 0 && (
            <section className="home-section">
              <div className="home-section-header">
                <h2>Metas de ahorro</h2>
                <Link to="/goals">Ver todas →</Link>
              </div>
              <div className="home-list">
                {goals.map((g) => (
                  <div className="home-list-row" key={g.id}>
                    <span>{g.name}</span>
                    <span>{g.percentComplete}%</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {pendingDebts.length > 0 && (
            <section className="home-section">
              <div className="home-section-header">
                <h2>Deudas pendientes</h2>
                <Link to="/debts">Ver todas →</Link>
              </div>
              <div className="home-stat-cards">
                {Object.entries(owedToMe).map(([currency, total]) => (
                  <div className="home-stat-card" key={`owed-to-me-${currency}`}>
                    <div className="home-stat-currency">Te deben ({currency})</div>
                    <div className="home-stat-amount income">{formatMoney(total, currency)}</div>
                  </div>
                ))}
                {Object.entries(owedByMe).map(([currency, total]) => (
                  <div className="home-stat-card" key={`owed-by-me-${currency}`}>
                    <div className="home-stat-currency">Debes ({currency})</div>
                    <div className="home-stat-amount negative">{formatMoney(total, currency)}</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="home-section">
            <div className="home-section-header">
              <h2>Movimientos de {formatMonthLabel(monthStart)}</h2>
            </div>
            {recentTransactions.length === 0 ? (
              <p className="accounts-empty">No hay movimientos en este mes.</p>
            ) : (
              <>
                <div className="home-list">
                  {recentTransactions.map((tx) => (
                    <div className="home-list-row" key={tx.id}>
                      <span>
                        {tx.transferId
                          ? `⇄ Transferencia (${tx.account.name})`
                          : tx.goal
                            ? `🎯 ${tx.goal.name} (${tx.account.name})`
                            : tx.loan
                              ? `🏦 ${tx.loan.name} (${tx.account.name})`
                              : `${tx.category?.emoji ? `${tx.category.emoji} ` : ''}${tx.category?.name} · ${tx.account.name}`}
                        <span className="home-list-date"> · {formatDate(tx.occurredAt)}</span>
                      </span>
                      <span className={tx.type === 'INCOME' ? 'income' : 'expense'}>
                        {tx.type === 'INCOME' ? '+' : '-'}
                        {formatMoney(tx.amount, tx.account.currency)}
                      </span>
                    </div>
                  ))}
                </div>
                {transactions.length > RECENT_TRANSACTIONS_LIMIT && (
                  <p className="home-more-note">
                    Mostrando {RECENT_TRANSACTIONS_LIMIT} de {transactions.length} movimientos de este mes.
                  </p>
                )}
              </>
            )}
          </section>
        </>
      )}
    </Layout>
  )
}
