import { useEffect, useState } from 'react'
import { ChevronDown, HandCoins, Trash2 } from 'lucide-react'
import { DebtForm } from '../components/DebtForm'
import { DebtPaymentForm } from '../components/DebtPaymentForm'
import { Layout } from '../components/Layout'
import { Badge, type BadgeTone } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { Modal } from '../components/ui/Modal'
import { Money } from '../components/ui/Money'
import { ProgressBar } from '../components/ui/ProgressBar'
import { SectionHeader } from '../components/ui/SectionHeader'
import { SummaryCard, SummaryGrid } from '../components/ui/SummaryCard'
import { useCreateFormToggle } from '../components/ui/useCreateFormToggle'
import { useAuth } from '../context/AuthContext'
import * as api from '../lib/api'
import { ApiError, type Account, type Debt, type DebtPayment } from '../lib/api'
import { onDataChanged } from '../lib/dataEvents'
import { formatDateOnly } from '../lib/dates'
import './DebtsPage.css'

function formatShortDate(iso: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(iso))
}

function paymentBadge(payment: DebtPayment): { label: string; tone: BadgeTone } {
  if (payment.status === 'CONFIRMED') return { label: 'Confirmado', tone: 'ok' }
  if (payment.status === 'REJECTED') return { label: 'Rechazado', tone: 'error' }
  return { label: 'Esperando confirmación', tone: 'warn' }
}

// Abonos que la otra persona registró y que me toca confirmar o rechazar.
function awaitingMyConfirmation(debt: Debt): DebtPayment[] {
  return debt.payments.filter((p) => p.status === 'PENDING_CONFIRMATION' && !p.createdByMe)
}

interface DebtGroupSummary {
  key: string
  direction: Debt['direction']
  currency: string
  count: number
  original: number
  remaining: number
  awaiting: number
}

// Un resumen por dirección y moneda, solo con deudas pendientes: sumar lo que
// te deben con lo que debes, o COP con USD, no significaría nada.
function summarize(debts: Debt[]): DebtGroupSummary[] {
  const groups = new Map<string, DebtGroupSummary>()
  for (const d of debts) {
    if (d.status !== 'PENDING') continue
    const key = `${d.direction}-${d.currency}`
    const g = groups.get(key) ?? {
      key,
      direction: d.direction,
      currency: d.currency,
      count: 0,
      original: 0,
      remaining: 0,
      awaiting: 0,
    }
    g.count += 1
    g.original += d.amount
    g.remaining += d.remainingBalance
    g.awaiting += d.payments.filter((p) => p.status === 'PENDING_CONFIRMATION').length
    groups.set(key, g)
  }
  // "Te deben" primero, luego "Debes"
  return Array.from(groups.values()).sort((a, b) => (a.direction === b.direction ? 0 : a.direction === 'THEY_OWE_ME' ? -1 : 1))
}

function DebtRow({
  debt,
  accounts,
  onChange,
  onDeleted,
}: {
  debt: Debt
  accounts: Account[]
  onChange: (d: Debt) => void
  onDeleted: (id: string) => void
}) {
  const { token } = useAuth()
  const owed = debt.direction === 'THEY_OWE_ME'
  const pending = debt.status === 'PENDING'
  const [paying, setPaying] = useState(false)
  const [showPayments, setShowPayments] = useState(false)

  async function handleDelete() {
    if (!token) return
    if (!confirm('¿Eliminar esta deuda pendiente? También se eliminan sus abonos registrados.')) return
    try {
      await api.deleteDebt(token, debt.id)
      onDeleted(debt.id)
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'No se pudo eliminar la deuda')
    }
  }

  return (
    <Card className="debt-row">
      <div className="debt-card-header">
        <div>
          <div className="debt-party">
            {debt.counterparty.name}
            {!debt.counterparty.isRegistered && (
              <span className="debt-unregistered" title="Esta persona no tiene cuenta en la app — sus abonos se confirman solos">
                sin cuenta
              </span>
            )}
            {!pending && <Badge tone="ok">Liquidada</Badge>}
          </div>
          {debt.description && <div className="debt-description">{debt.description}</div>}
        </div>
        <div className="debt-header-right">
          <Money amount={debt.remainingBalance} currency={debt.currency} tone={owed ? 'positive' : 'negative'} size="lg" />
          {pending && debt.createdByMe && (
            <button
              type="button"
              className="icon-danger-btn"
              title="Eliminar deuda"
              aria-label={`Eliminar la deuda con ${debt.counterparty.name}`}
              onClick={handleDelete}
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>

      <ProgressBar value={debt.percentPaid} tone={pending ? 'accent' : 'ok'} height={8} />
      <div className="debt-amounts">
        <span>
          Original <Money amount={debt.amount} currency={debt.currency} />
        </span>
        <span>{debt.percentPaid}% abonado</span>
      </div>

      {!pending && debt.settledAt && <div className="debt-settled">Liquidada el {formatDateOnly(debt.settledAt)}</div>}

      <div className="debt-actions">
        {pending && (
          <Button variant="secondary" onClick={() => setPaying(true)}>
            Registrar abono
          </Button>
        )}
        {debt.payments.length > 0 && (
          <button type="button" className="debt-toggle" onClick={() => setShowPayments((v) => !v)} aria-expanded={showPayments}>
            Abonos ({debt.payments.length})
            <ChevronDown size={14} className={`debt-toggle-chevron ${showPayments ? 'open' : ''}`} />
          </button>
        )}
      </div>

      {showPayments && (
        <div className="debt-payments">
          {debt.payments.map((payment) => {
            const pBadge = paymentBadge(payment)
            const resolved = payment.status !== 'PENDING_CONFIRMATION'
            return (
              <div key={payment.id} className={`debt-payment-row${resolved ? ' is-resolved' : ''}`}>
                <div className="debt-payment-info">
                  <span>
                    <Money amount={payment.amount} currency={debt.currency} /> · {formatShortDate(payment.occurredAt)}
                  </span>
                  {payment.note && <span className="debt-payment-note">{payment.note}</span>}
                </div>
                <div className="debt-payment-row-actions">
                  {payment.status === 'PENDING_CONFIRMATION' && payment.createdByMe ? (
                    <span className="debt-waiting">Esperando confirmación de {debt.counterparty.name}</span>
                  ) : (
                    <Badge tone={pBadge.tone}>
                      {payment.status === 'PENDING_CONFIRMATION' ? 'Por confirmar' : pBadge.label}
                    </Badge>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal open={paying} onClose={() => setPaying(false)} title={`Abono · ${debt.counterparty.name}`}>
        <DebtPaymentForm
          debt={debt}
          accounts={accounts}
          onDone={(updated) => {
            onChange(updated)
            setPaying(false)
          }}
        />
      </Modal>
    </Card>
  )
}

export function DebtsPage() {
  const { token } = useAuth()
  const [debts, setDebts] = useState<Debt[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyPayment, setBusyPayment] = useState<string | null>(null)
  const [showSettled, setShowSettled] = useState(false)

  const { open: showForm, toggle: toggleForm, close: closeForm } = useCreateFormToggle()

  useEffect(() => {
    if (!token) return
    Promise.all([api.getDebts(token), api.getAccounts(token)])
      .then(([d, a]) => {
        setDebts(d)
        setAccounts(a)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Error al cargar deudas'))
      .finally(() => setLoading(false))
  }, [token])

  useEffect(() => {
    if (!token) return
    return onDataChanged(() => {
      api
        .getAccounts(token)
        .then(setAccounts)
        .catch(() => {})
    })
  }, [token])

  function refreshAccounts() {
    if (token) api.getAccounts(token).then(setAccounts).catch(() => {})
  }

  function handleCreated(debt: Debt) {
    setDebts((prev) => [debt, ...prev])
    closeForm()
  }

  function updateOne(updated: Debt) {
    setDebts((prev) => prev.map((d) => (d.id === updated.id ? updated : d)))
    // Un abono mueve dinero real en una cuenta: refrescar saldos.
    refreshAccounts()
  }

  function removeOne(id: string) {
    setDebts((prev) => prev.filter((d) => d.id !== id))
  }

  async function resolvePayment(debt: Debt, payment: DebtPayment, action: 'confirm' | 'reject') {
    if (!token) return
    setBusyPayment(payment.id)
    try {
      const updated =
        action === 'confirm'
          ? await api.confirmDebtPayment(token, debt.id, payment.id)
          : await api.rejectDebtPayment(token, debt.id, payment.id)
      updateOne(updated)
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'No se pudo completar la acción')
    } finally {
      setBusyPayment(null)
    }
  }

  const pendingDebts = debts.filter((d) => d.status === 'PENDING')
  const settledDebts = debts.filter((d) => d.status === 'SETTLED')
  const owedToMe = pendingDebts.filter((d) => d.direction === 'THEY_OWE_ME')
  const owedByMe = pendingDebts.filter((d) => d.direction === 'I_OWE_THEM')
  const toConfirm = debts.flatMap((debt) => awaitingMyConfirmation(debt).map((payment) => ({ debt, payment })))

  const renderRow = (debt: Debt) => (
    <DebtRow key={debt.id} debt={debt} accounts={accounts} onChange={updateOne} onDeleted={removeOne} />
  )

  return (
    <Layout fabActions={[{ label: 'Nueva deuda', icon: HandCoins, onClick: toggleForm }]}>
      <SectionHeader as="h1" title="Deudas">
        <Button className="toolbar-create-btn" onClick={toggleForm}>
          + Nueva deuda
        </Button>
      </SectionHeader>

      <Modal open={showForm} onClose={closeForm} title="Nueva deuda">
        <DebtForm onCreated={handleCreated} />
      </Modal>

      {loading && <p>Cargando…</p>}
      {error && <div className="auth-error">{error}</div>}

      {!loading && !error && debts.length === 0 && <EmptyState>No tienes deudas registradas.</EmptyState>}

      {toConfirm.length > 0 && (
        <section className="debt-confirm" aria-label="Abonos por confirmar">
          <h2>Por confirmar ({toConfirm.length})</h2>
          <div className="debt-confirm-list">
            {toConfirm.map(({ debt, payment }) => (
              <Card key={payment.id} className="debt-confirm-card">
                <div className="debt-confirm-text">
                  <strong>{debt.counterparty.name}</strong> registró un abono de{' '}
                  <Money amount={payment.amount} currency={debt.currency} /> · {formatShortDate(payment.occurredAt)}
                  {payment.note && <span className="debt-payment-note"> — {payment.note}</span>}
                </div>
                <div className="debt-payment-row-actions">
                  <Button disabled={busyPayment === payment.id} onClick={() => resolvePayment(debt, payment, 'confirm')}>
                    Confirmar
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={busyPayment === payment.id}
                    onClick={() => resolvePayment(debt, payment, 'reject')}
                  >
                    Rechazar
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {pendingDebts.length > 0 && (
        <SummaryGrid label="Resumen de deudas">
          {summarize(debts).map((g) => {
            const owed = g.direction === 'THEY_OWE_ME'
            const percentPaid = g.original > 0 ? ((g.original - g.remaining) / g.original) * 100 : 0
            return (
              <SummaryCard
                key={g.key}
                label={`${owed ? 'Te deben' : 'Debes'} · ${g.currency}`}
                main={
                  <>
                    <Money amount={g.remaining} currency={g.currency} tone={owed ? 'positive' : 'negative'} size="lg" />
                    <span>
                      pendiente de <Money amount={g.original} currency={g.currency} />
                    </span>
                  </>
                }
                progress={{ value: percentPaid, tone: 'accent' }}
                footLeft={`${Math.round(percentPaid)}% ${owed ? 'recuperado' : 'pagado'}`}
                footRight={
                  <>
                    {g.count} deuda{g.count !== 1 ? 's' : ''}
                    {g.awaiting > 0 && (
                      <Badge tone="warn">
                        {g.awaiting} abono{g.awaiting !== 1 ? 's' : ''} por confirmar
                      </Badge>
                    )}
                  </>
                }
              />
            )
          })}
        </SummaryGrid>
      )}

      {owedToMe.length > 0 && (
        <section className="debt-section">
          <h2>
            Me deben <span className="debt-section-count">{owedToMe.length}</span>
          </h2>
          <div className="debts-list">{owedToMe.map(renderRow)}</div>
        </section>
      )}

      {owedByMe.length > 0 && (
        <section className="debt-section">
          <h2>
            Yo debo <span className="debt-section-count">{owedByMe.length}</span>
          </h2>
          <div className="debts-list">{owedByMe.map(renderRow)}</div>
        </section>
      )}

      {settledDebts.length > 0 && (
        <section className="debt-section">
          <button type="button" className="debt-settled-toggle" onClick={() => setShowSettled((v) => !v)} aria-expanded={showSettled}>
            Liquidadas ({settledDebts.length})
            <ChevronDown size={16} className={`debt-toggle-chevron ${showSettled ? 'open' : ''}`} />
          </button>
          {showSettled && <div className="debts-list">{settledDebts.map(renderRow)}</div>}
        </section>
      )}
    </Layout>
  )
}
