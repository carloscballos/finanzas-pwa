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
import { Badge } from '../components/ui/Badge'
import { CardGrid } from '../components/ui/CardGrid'
import { EmptyState } from '../components/ui/EmptyState'
import { IconChip } from '../components/ui/IconChip'
import { ListRow } from '../components/ui/ListRow'
import { Money } from '../components/ui/Money'
import { SectionHeader } from '../components/ui/SectionHeader'
import { StatCard } from '../components/ui/StatCard'
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
  // cuentas no es ingreso ni gasto real, solo reubicación. Lo mismo aplica al
  // pagar la cuota de una compra de tarjeta (EXPENSE en la cuenta que paga +
  // INCOME en la tarjeta, como un transfer) — solo cuenta como gasto real la
  // pata de la compra en sí (el EXPENSE inicial en la tarjeta), no cada pago
  // de cuota, o se contaría la misma compra varias veces.
  const creditCardAccountIds = new Set(
    accounts.filter((a) => a.type === 'CREDIT_CARD').map((a) => a.id),
  )
  const monthFlows = transactions.filter((tx) => {
    if (tx.transferId) return false
    if (tx.cardPurchase) return tx.type === 'EXPENSE' && creditCardAccountIds.has(tx.account.id)
    return true
  })
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
    { to: '/accounts?new=1', label: 'Nueva cuenta', icon: Wallet, tone: 'accent' as const },
    { to: newTransactionHref, label: 'Nuevo movimiento', icon: Receipt, tone: 'ok' as const },
    { to: '/goals?new=1', label: 'Nueva meta', icon: Target, tone: 'warn' as const },
    { to: '/budgets?new=1', label: 'Nuevo presupuesto', icon: PiggyBank, tone: 'neutral' as const },
    { to: '/loans?new=1', label: 'Nuevo préstamo', icon: Landmark, tone: 'error' as const },
    { to: '/forecast', label: 'Ver proyección', icon: TrendingUp, tone: 'accent' as const },
  ]

  return (
    <Layout>
      <SectionHeader as="h1" title={`Hola, ${user?.name?.split(' ')[0]}`} subtitle="Este es tu resumen financiero" />

      <div className="home-quick-actions">
        {quickActions.map((action) => (
          <Link className="home-quick-action" to={action.to} key={action.label}>
            <IconChip tone={action.tone}>
              <action.icon size={18} strokeWidth={2} />
            </IconChip>
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
            <SectionHeader title="Saldo total" />
            {accounts.length === 0 ? (
              <EmptyState>Todavía no tienes cuentas — créalas en Cuentas.</EmptyState>
            ) : (
              <>
                {personalAccounts.length > 0 && (
                  <div className="home-balance-group">
                    <div className="home-balance-group-label">Cuentas personales</div>
                    <CardGrid minWidth={240}>
                      {Object.entries(personalBalancesByCurrency).map(([currency, total]) => (
                        <StatCard
                          key={currency}
                          label={currency}
                          value={<Money amount={total} currency={currency} tone="balance" size="lg" />}
                        />
                      ))}
                    </CardGrid>
                  </div>
                )}
                {sharedAccounts.length > 0 && (
                  <div className="home-balance-group">
                    <div className="home-balance-group-label">Cuentas compartidas</div>
                    <CardGrid minWidth={240}>
                      {Object.entries(sharedBalancesByCurrency).map(([currency, total]) => (
                        <StatCard
                          key={currency}
                          label={currency}
                          value={<Money amount={total} currency={currency} tone="balance" size="lg" />}
                        />
                      ))}
                    </CardGrid>
                  </div>
                )}
              </>
            )}
          </section>

          {monthCurrencies.length > 0 && (
            <section className="home-section">
              <SectionHeader title={`Resumen de ${formatMonthLabel(monthStart)}`} />
              <CardGrid minWidth={240}>
                {monthCurrencies.map((currency) => {
                  const income = monthIncomeByCurrency[currency] ?? 0
                  const expense = monthExpenseByCurrency[currency] ?? 0
                  return (
                    <StatCard
                      key={currency}
                      label={currency}
                      value={<Money amount={income - expense} currency={currency} tone="flow" size="lg" />}
                      sub={
                        <>
                          +<Money amount={income} currency={currency} /> / -
                          <Money amount={expense} currency={currency} />
                        </>
                      }
                    />
                  )
                })}
              </CardGrid>
            </section>
          )}

          {pendingRequestsCount > 0 && (
            <section className="home-section">
              <SectionHeader title="Solicitudes pendientes" />
              <div className="home-requests-list">
                {invitations.map((inv) => (
                  <ListRow
                    key={`inv-${inv.id}`}
                    href="/invitations"
                    title={
                      <>
                        Invitación a <strong>{inv.account.name}</strong> de {inv.invitedBy.name}
                      </>
                    }
                    trailing={<Badge tone="warn">Ver</Badge>}
                  />
                ))}
                {friendRequests.map((r) => (
                  <ListRow
                    key={`fr-${r.id}`}
                    href="/friends"
                    title={
                      <>
                        Solicitud de amistad de <strong>{r.requestedBy.name}</strong>
                      </>
                    }
                    trailing={<Badge tone="warn">Ver</Badge>}
                  />
                ))}
              </div>
            </section>
          )}

          {forecast.length > 0 && (
            <section className="home-section">
              <SectionHeader title="Proyección mensual">
                <Link to="/forecast">Ver detalle →</Link>
              </SectionHeader>
              <CardGrid minWidth={240}>
                {forecast.map((f) => (
                  <StatCard
                    key={f.currency}
                    label={f.currency}
                    value={<Money amount={f.projectedMonthlyNet} currency={f.currency} tone="flow" size="lg" />}
                    sub={
                      <>
                        +<Money amount={f.projectedMonthlyIncome} currency={f.currency} /> / -
                        <Money amount={f.projectedMonthlyExpense} currency={f.currency} />
                      </>
                    }
                  />
                ))}
              </CardGrid>
            </section>
          )}

          {budgetsAtRisk.length > 0 && (
            <section className="home-section">
              <SectionHeader title="Presupuestos en riesgo">
                <Link to="/budgets">Ver todos →</Link>
              </SectionHeader>
              <div className="home-list">
                {budgetsAtRisk.map((b) => (
                  <ListRow
                    key={b.id}
                    title={`${b.category.emoji ? `${b.category.emoji} ` : ''}${b.category.name}`}
                    trailing={<Badge tone={b.percentUsed >= 100 ? 'error' : 'warn'}>{b.percentUsed}% usado</Badge>}
                  />
                ))}
              </div>
            </section>
          )}

          {goals.length > 0 && (
            <section className="home-section">
              <SectionHeader title="Metas de ahorro">
                <Link to="/goals">Ver todas →</Link>
              </SectionHeader>
              <div className="home-list">
                {goals.map((g) => (
                  <ListRow key={g.id} title={g.name} trailing={`${g.percentComplete}%`} />
                ))}
              </div>
            </section>
          )}

          {pendingDebts.length > 0 && (
            <section className="home-section">
              <SectionHeader title="Deudas pendientes">
                <Link to="/debts">Ver todas →</Link>
              </SectionHeader>
              <CardGrid minWidth={240}>
                {Object.entries(owedToMe).map(([currency, total]) => (
                  <StatCard
                    key={`owed-to-me-${currency}`}
                    label={`Te deben (${currency})`}
                    value={<Money amount={total} currency={currency} tone="positive" size="lg" />}
                  />
                ))}
                {Object.entries(owedByMe).map(([currency, total]) => (
                  <StatCard
                    key={`owed-by-me-${currency}`}
                    label={`Debes (${currency})`}
                    value={<Money amount={total} currency={currency} tone="negative" size="lg" />}
                  />
                ))}
              </CardGrid>
            </section>
          )}

          <section className="home-section">
            <SectionHeader title={`Movimientos de ${formatMonthLabel(monthStart)}`} />
            {recentTransactions.length === 0 ? (
              <EmptyState>No hay movimientos en este mes.</EmptyState>
            ) : (
              <>
                <div className="home-list">
                  {recentTransactions.map((tx) => {
                    const emoji = tx.transferId
                      ? '⇄'
                      : tx.goal
                        ? '🎯'
                        : tx.loan
                          ? '🏦'
                          : tx.cardPurchase
                            ? '🛍️'
                            : (tx.category?.emoji ?? '💰')
                    const label = tx.transferId
                      ? `Transferencia (${tx.account.name})`
                      : tx.goal
                        ? `${tx.goal.name} (${tx.account.name})`
                        : tx.loan
                          ? `${tx.loan.name} (${tx.account.name})`
                          : tx.cardPurchase
                            ? `${tx.cardPurchase.merchant} (${tx.account.name})`
                            : `${tx.category?.name} · ${tx.account.name}`
                    return (
                      <ListRow
                        key={tx.id}
                        leading={<IconChip tone={tx.type === 'INCOME' ? 'ok' : 'error'}>{emoji}</IconChip>}
                        title={label}
                        subtitle={formatDate(tx.occurredAt)}
                        trailing={
                          <Money
                            amount={tx.amount}
                            currency={tx.account.currency}
                            tone={tx.type === 'INCOME' ? 'positive' : 'negative'}
                            showSign
                          />
                        }
                      />
                    )
                  })}
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
