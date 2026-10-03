import { Fragment, useEffect, useState, type ReactNode } from 'react'
import { AccountForm } from '../components/AccountForm'
import { BudgetForm } from '../components/BudgetForm'
import { DebtForm } from '../components/DebtForm'
import { GoalForm } from '../components/GoalForm'
import { LoanForm } from '../components/LoanForm'
import { Layout } from '../components/Layout'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { AddTile, HomeRow, TileCard } from '../components/ui/HomeRow'
import { ListRow } from '../components/ui/ListRow'
import { Modal } from '../components/ui/Modal'
import { Money } from '../components/ui/Money'
import { SectionHeader } from '../components/ui/SectionHeader'
import { PendingTransactionsDrawer } from '../components/PendingTransactionsDrawer'
import { useAuth } from '../context/AuthContext'
import * as api from '../lib/api'
import {
  ApiError,
  type Account,
  type Budget,
  type Category,
  type Debt,
  type ForecastSummary,
  type FriendRequest,
  type Goal,
  type Invitation,
  type Loan,
} from '../lib/api'
import { onDataChanged } from '../lib/dataEvents'
import './HomePage.css'

type NewItem = 'account' | 'card' | 'budget' | 'goal' | 'debt' | 'loan'

const NEW_ITEM_TITLES: Record<NewItem, string> = {
  account: 'Nueva cuenta',
  card: 'Nueva tarjeta de crédito',
  budget: 'Nuevo presupuesto',
  goal: 'Nueva meta',
  debt: 'Nueva deuda',
  loan: 'Nuevo préstamo',
}

const BUDGET_WARN_THRESHOLD = 70
const CARD_DUE_SOON_DAYS = 5

function sumByCurrency(amounts: { amount: number; currency: string }[]): Record<string, number> {
  const totals: Record<string, number> = {}
  for (const { amount, currency } of amounts) {
    totals[currency] = (totals[currency] ?? 0) + amount
  }
  return totals
}

// Una línea de totales por moneda para el resumen del encabezado de cada fila:
// "COP $ 8.420.000 · USD US$ 866,00".
function CurrencyTotals({
  totals,
  tone = 'neutral',
}: {
  totals: Record<string, number>
  tone?: 'neutral' | 'balance' | 'positive' | 'negative'
}) {
  const entries = Object.entries(totals)
  if (entries.length === 0) return null
  return (
    <>
      {entries.map(([currency, amount], i) => (
        <Fragment key={currency}>
          {i > 0 && ' · '}
          <Money amount={amount} currency={currency} tone={tone} />
        </Fragment>
      ))}
    </>
  )
}

// Días hasta el próximo día de pago de la tarjeta (hoy cuenta como 0).
function daysUntilDue(dueDay: number): number {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dueThisMonth = new Date(now.getFullYear(), now.getMonth(), dueDay)
  const due =
    dueThisMonth >= today ? dueThisMonth : new Date(now.getFullYear(), now.getMonth() + 1, dueDay)
  return Math.round((due.getTime() - today.getTime()) / 86_400_000)
}

function budgetTone(percentUsed: number) {
  if (percentUsed >= 100) return 'error' as const
  if (percentUsed >= BUDGET_WARN_THRESHOLD) return 'warn' as const
  return 'ok' as const
}

export function HomePage() {
  const { user, token } = useAuth()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [debts, setDebts] = useState<Debt[]>([])
  const [loans, setLoans] = useState<Loan[]>([])
  const [forecast, setForecast] = useState<ForecastSummary[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingCount, setPendingCount] = useState(0)
  const [showPendingDrawer, setShowPendingDrawer] = useState(false)
  // Qué modal de creación está abierto (null = ninguno). 'card' es el form de
  // cuenta ya preseleccionado en tarjeta de crédito.
  const [creating, setCreating] = useState<NewItem | null>(null)

  useEffect(() => {
    if (!token) return
    let ignore = false
    setLoading(true)
    setError(null)
    Promise.all([
      api.getAccounts(token),
      api.getCategories(token),
      api.getBudgets(token),
      api.getGoals(token),
      api.getDebts(token),
      api.getLoans(token),
      api.getForecastSummary(token),
      api.getMyInvitations(token),
      api.getReceivedFriendRequests(token),
      api.getPendingTransactions(token),
    ])
      .then(([accs, cats, bud, gls, dbts, lns, fc, invs, freqs, pending]) => {
        if (ignore) return
        setAccounts(accs)
        setCategories(cats)
        setBudgets(bud)
        setGoals(gls)
        setDebts(dbts)
        setLoans(lns)
        setForecast(fc)
        setInvitations(invs.filter((i) => i.status === 'PENDING'))
        setFriendRequests(freqs)
        setPendingCount(pending.length)
      })
      .catch((err) => {
        if (!ignore) setError(err instanceof ApiError ? err.message : 'Error al cargar el resumen')
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [token])

  // Cuando se registra un movimiento desde el botón global, se refrescan solo
  // los saldos, presupuestos y proyección (sin parpadeo de "Cargando…").
  useEffect(() => {
    if (!token) return
    return onDataChanged(() => {
      Promise.all([api.getAccounts(token), api.getBudgets(token), api.getForecastSummary(token)])
        .then(([accs, bud, fc]) => {
          setAccounts(accs)
          setBudgets(bud)
          setForecast(fc)
        })
        .catch(() => {})
    })
  }, [token])

  const regularAccounts = accounts.filter((a) => a.type !== 'CREDIT_CARD')
  const creditCards = accounts.filter((a) => a.type === 'CREDIT_CARD')
  const balancesByCurrency = sumByCurrency(
    regularAccounts.map((a) => ({ amount: a.currentBalance, currency: a.currency })),
  )
  // Cupo disponible = límite + saldo (el saldo de una tarjeta es negativo
  // cuando hay compras pendientes). Sin límite configurado no hay contra qué
  // calcularlo, así que esa tarjeta no suma al total del encabezado.
  const availableByCurrency = sumByCurrency(
    creditCards
      .filter((a) => a.creditLimit != null)
      .map((a) => ({ amount: (a.creditLimit ?? 0) + a.currentBalance, currency: a.currency })),
  )
  const activeLoans = loans.filter((l) => l.status === 'ACTIVE')
  const loanBalancesByCurrency = sumByCurrency(
    activeLoans.map((l) => ({ amount: l.remainingBalance, currency: l.currency })),
  )
  const pendingDebts = debts.filter((d) => d.status !== 'SETTLED')
  const owedToMe = sumByCurrency(
    pendingDebts
      .filter((d) => d.direction === 'THEY_OWE_ME')
      .map((d) => ({ amount: d.remainingBalance, currency: d.currency })),
  )
  const owedByMe = sumByCurrency(
    pendingDebts
      .filter((d) => d.direction === 'I_OWE_THEM')
      .map((d) => ({ amount: d.remainingBalance, currency: d.currency })),
  )
  const pendingRequestsCount = invitations.length + friendRequests.length

  let debtsSummary: ReactNode = null
  if (Object.keys(owedToMe).length > 0 || Object.keys(owedByMe).length > 0) {
    debtsSummary = (
      <>
        {Object.keys(owedToMe).length > 0 && (
          <>
            Te deben <CurrencyTotals totals={owedToMe} tone="positive" />
          </>
        )}
        {Object.keys(owedToMe).length > 0 && Object.keys(owedByMe).length > 0 && ' · '}
        {Object.keys(owedByMe).length > 0 && (
          <>
            Debes <CurrencyTotals totals={owedByMe} tone="negative" />
          </>
        )}
      </>
    )
  }

  return (
    <Layout>
      <SectionHeader as="h1" title={`Hola, ${user?.name?.split(' ')[0]}`} subtitle="Este es tu resumen financiero">
        {pendingCount > 0 && (
          <Button onClick={() => setShowPendingDrawer(true)} variant="secondary">
            {pendingCount} pago{pendingCount !== 1 ? 's' : ''} pendiente{pendingCount !== 1 ? 's' : ''}
          </Button>
        )}
      </SectionHeader>

      {loading && <p>Cargando…</p>}
      {error && <div className="auth-error">{error}</div>}

      {!loading && !error && (
        <>
          {pendingRequestsCount > 0 && (
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
          )}

          <HomeRow title="Cuentas" to="/accounts" summary={<CurrencyTotals totals={balancesByCurrency} tone="balance" />}>
            {regularAccounts.map((a) => (
              <TileCard
                key={a.id}
                to={`/accounts/${a.id}/transactions`}
                label={a.name}
                badge={a.memberCount > 1 ? <Badge tone="neutral">Compartida</Badge> : undefined}
                value={<Money amount={a.currentBalance} currency={a.currency} tone="balance" />}
                sub={a.currency}
              />
            ))}
            <AddTile onClick={() => setCreating('account')} label="Nueva cuenta" />
          </HomeRow>

          <HomeRow
            title="Tarjetas de crédito"
            to="/cards"
            summary={
              Object.keys(availableByCurrency).length > 0 ? (
                <>
                  Cupo disponible <CurrencyTotals totals={availableByCurrency} />
                </>
              ) : undefined
            }
          >
            {creditCards.map((a) => {
              const hasLimit = a.creditLimit != null
              const available = (a.creditLimit ?? 0) + a.currentBalance
              const used = Math.max(0, -a.currentBalance)
              const percentUsed = hasLimit && a.creditLimit! > 0 ? (used / a.creditLimit!) * 100 : 0
              const dueIn = a.paymentDueDay != null ? daysUntilDue(a.paymentDueDay) : null
              return (
                <TileCard
                  key={a.id}
                  to={`/accounts/${a.id}/transactions`}
                  label={a.name}
                  badge={
                    dueIn != null && dueIn <= CARD_DUE_SOON_DAYS ? (
                      <Badge tone="warn">{dueIn === 0 ? 'Vence hoy' : `Vence en ${dueIn} d`}</Badge>
                    ) : undefined
                  }
                  value={
                    hasLimit ? (
                      <Money amount={available} currency={a.currency} tone="balance" />
                    ) : (
                      <Money amount={used} currency={a.currency} tone={used > 0 ? 'negative' : 'neutral'} />
                    )
                  }
                  sub={
                    hasLimit ? (
                      <>
                        Disponible de <Money amount={a.creditLimit!} currency={a.currency} />
                      </>
                    ) : (
                      'Saldo adeudado'
                    )
                  }
                  progress={hasLimit ? { value: percentUsed, tone: budgetTone(percentUsed) } : undefined}
                />
              )
            })}
            <AddTile onClick={() => setCreating('card')} label="Nueva tarjeta" />
          </HomeRow>

          <HomeRow title="Presupuestos" to="/budgets">
            {budgets.map((b) => (
              <TileCard
                key={b.id}
                to="/budgets"
                label={`${b.category.emoji ? `${b.category.emoji} ` : ''}${b.category.name}`}
                value={<Money amount={b.remaining} currency={b.currency} tone="balance" />}
                sub={
                  <>
                    {b.remaining < 0 ? 'Pasado de ' : 'Restan de '}
                    <Money amount={b.limitAmount} currency={b.currency} />
                  </>
                }
                progress={{ value: b.percentUsed, tone: budgetTone(b.percentUsed) }}
              />
            ))}
            <AddTile onClick={() => setCreating('budget')} label="Nuevo presupuesto" />
          </HomeRow>

          <HomeRow title="Metas" to="/goals">
            {goals.map((g) => (
              <TileCard
                key={g.id}
                to="/goals"
                label={g.name}
                value={`${g.percentComplete}%`}
                sub={
                  <>
                    <Money amount={g.currentAmount} currency={g.currency} /> de{' '}
                    <Money amount={g.targetAmount} currency={g.currency} />
                  </>
                }
                progress={{ value: g.percentComplete }}
              />
            ))}
            <AddTile onClick={() => setCreating('goal')} label="Nueva meta" />
          </HomeRow>

          <HomeRow title="Deudas" to="/debts" summary={debtsSummary}>
            {pendingDebts.map((d) => (
              <TileCard
                key={d.id}
                to="/debts"
                label={d.counterparty.name}
                badge={<Badge tone={d.direction === 'THEY_OWE_ME' ? 'ok' : 'error'}>{d.direction === 'THEY_OWE_ME' ? 'Te debe' : 'Debes'}</Badge>}
                value={
                  <Money
                    amount={d.remainingBalance}
                    currency={d.currency}
                    tone={d.direction === 'THEY_OWE_ME' ? 'positive' : 'negative'}
                  />
                }
                sub={d.description ?? 'Pendiente'}
                progress={{ value: d.percentPaid }}
              />
            ))}
            <AddTile onClick={() => setCreating('debt')} label="Nueva deuda" />
          </HomeRow>

          <HomeRow
            title="Préstamos"
            to="/loans"
            summary={
              Object.keys(loanBalancesByCurrency).length > 0 ? (
                <>
                  Saldo <CurrencyTotals totals={loanBalancesByCurrency} />
                </>
              ) : undefined
            }
          >
            {activeLoans.map((l) => (
              <TileCard
                key={l.id}
                to="/loans"
                label={l.name}
                badge={
                  <span>
                    {l.installmentsPaid}/{l.installmentsTotal}
                  </span>
                }
                value={<Money amount={l.remainingBalance} currency={l.currency} />}
                sub={
                  <>
                    Próxima cuota ≈{' '}
                    <Money amount={l.nextInstallment?.total ?? l.installmentAmount} currency={l.currency} />
                  </>
                }
                progress={{ value: l.percentPaid }}
              />
            ))}
            <AddTile onClick={() => setCreating('loan')} label="Nuevo préstamo" />
          </HomeRow>

          {forecast.length > 0 && (
            <HomeRow title="Proyección mensual" to="/forecast">
              {forecast.map((f) => (
                <TileCard
                  key={f.currency}
                  to="/forecast"
                  label={`${f.currency} · neto del mes`}
                  value={<Money amount={f.projectedMonthlyNet} currency={f.currency} tone="flow" />}
                  sub={
                    <div className="home-tile-lines">
                      <div>
                        <span>Ingresos</span>
                        <Money amount={f.projectedMonthlyIncome} currency={f.currency} tone="positive" />
                      </div>
                      <div>
                        <span>Gastos</span>
                        <Money amount={f.projectedMonthlyExpense} currency={f.currency} tone="negative" />
                      </div>
                      {f.projectedMonthlyCardInstallments > 0 && (
                        <div>
                          <span>· de eso, cuotas de tarjeta</span>
                          <Money amount={f.projectedMonthlyCardInstallments} currency={f.currency} />
                        </div>
                      )}
                    </div>
                  }
                />
              ))}
            </HomeRow>
          )}
        </>
      )}

      <Modal open={creating !== null} onClose={() => setCreating(null)} title={creating ? NEW_ITEM_TITLES[creating] : ''}>
        {(creating === 'account' || creating === 'card') && (
          <AccountForm
            kind={creating === 'card' ? 'card' : 'account'}
            onCreated={(account) => {
              setAccounts((prev) => [...prev, account])
              setCreating(null)
            }}
          />
        )}
        {creating === 'budget' && (
          <BudgetForm
            categories={categories}
            onCreated={(budget) => {
              setBudgets((prev) => [...prev, budget])
              setCreating(null)
            }}
          />
        )}
        {creating === 'goal' && (
          <GoalForm
            accounts={accounts}
            onCreated={(goal) => {
              setGoals((prev) => [...prev, goal])
              setCreating(null)
            }}
          />
        )}
        {creating === 'debt' && (
          <DebtForm
            onCreated={(debt) => {
              setDebts((prev) => [debt, ...prev])
              setCreating(null)
            }}
          />
        )}
        {creating === 'loan' && (
          <LoanForm
            accounts={accounts}
            onCreated={(loan) => {
              setLoans((prev) => [loan, ...prev])
              setCreating(null)
            }}
          />
        )}
      </Modal>

      {token && (
        <PendingTransactionsDrawer
          isOpen={showPendingDrawer}
          onClose={() => setShowPendingDrawer(false)}
          token={token}
          accounts={accounts}
          categories={categories}
          onConfirmed={() => {
            setShowPendingDrawer(false)
            setPendingCount((c) => Math.max(0, c - 1))
          }}
        />
      )}
    </Layout>
  )
}
