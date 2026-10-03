import { useEffect, useState, type FormEvent } from 'react'
import { ChevronDown, Landmark, Pencil, Trash2 } from 'lucide-react'
import { LoanForm } from '../components/LoanForm'
import { LoanPaymentForm } from '../components/LoanPaymentForm'
import { Layout } from '../components/Layout'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { Form, FormError, FormField } from '../components/ui/Form'
import { Modal } from '../components/ui/Modal'
import { Money } from '../components/ui/Money'
import { ProgressBar } from '../components/ui/ProgressBar'
import { SectionHeader } from '../components/ui/SectionHeader'
import { SummaryCard, SummaryGrid } from '../components/ui/SummaryCard'
import { useCreateFormToggle } from '../components/ui/useCreateFormToggle'
import { useAuth } from '../context/AuthContext'
import { usePrivacy } from '../context/PrivacyContext'
import * as api from '../lib/api'
import { ApiError, type Account, type Loan } from '../lib/api'
import { onDataChanged } from '../lib/dataEvents'
import { daysUntilDayOfMonth } from '../lib/dates'
import { formatMoneyMaybeHidden, sanitizeDecimalInput } from '../lib/money'
import './LoansPage.css'

const DUE_SOON_DAYS = 5

interface LoanGroupSummary {
  currency: string
  count: number
  principal: number
  remaining: number
  monthly: number
  dueSoon: number
}

// Un resumen por moneda, solo con préstamos activos: sumar COP con USD no
// significaría nada. `monthly` es lo que se paga al mes entre todos.
function summarize(loans: Loan[]): LoanGroupSummary[] {
  const groups = new Map<string, LoanGroupSummary>()
  for (const l of loans) {
    if (l.status !== 'ACTIVE') continue
    const g = groups.get(l.currency) ?? { currency: l.currency, count: 0, principal: 0, remaining: 0, monthly: 0, dueSoon: 0 }
    g.count += 1
    g.principal += l.principal
    g.remaining += l.remainingBalance
    g.monthly += l.installmentAmount
    if (l.dueDay !== null && daysUntilDayOfMonth(l.dueDay) <= DUE_SOON_DAYS) g.dueSoon += 1
    groups.set(l.currency, g)
  }
  return Array.from(groups.values())
}

function LoanRow({
  loan,
  accounts,
  onChange,
  onDeleted,
}: {
  loan: Loan
  accounts: Account[]
  onChange: (l: Loan) => void
  onDeleted: (id: string) => void
}) {
  const { token } = useAuth()
  const { hideValues } = usePrivacy()
  const fmt = (value: number) => formatMoneyMaybeHidden(value, loan.currency, hideValues)
  const active = loan.status !== 'PAID_OFF'
  const [paying, setPaying] = useState(false)

  const [editing, setEditing] = useState(false)
  const [editInstallmentAmount, setEditInstallmentAmount] = useState('')
  const [editInterestRate, setEditInterestRate] = useState('')
  const [editInsurance, setEditInsurance] = useState('')
  const [editRemaining, setEditRemaining] = useState('')
  const [editBusy, setEditBusy] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  const dueIn = active && loan.dueDay !== null ? daysUntilDayOfMonth(loan.dueDay) : null

  function startEditing() {
    setEditInstallmentAmount(String(loan.installmentAmount))
    setEditInterestRate(loan.interestRate === null ? '' : String(loan.interestRate))
    setEditInsurance(loan.insuranceAmount === null ? '' : String(loan.insuranceAmount))
    setEditRemaining(String(loan.remainingBalance))
    setEditError(null)
    setEditing(true)
  }

  // Conciliar con el extracto: solo cambia el plan hacia adelante, no toca
  // los pagos ya registrados (ver UpdateLoanDto en el backend).
  async function handleSaveEdit(event: FormEvent) {
    event.preventDefault()
    if (!token) return
    setEditBusy(true)
    setEditError(null)
    try {
      const updated = await api.updateLoan(token, loan.id, {
        installmentAmount: Number(editInstallmentAmount),
        interestRate: editInterestRate ? Number(editInterestRate) : undefined,
        insuranceAmount: editInsurance ? Number(editInsurance) : 0,
        remainingBalance: Number(editRemaining),
      })
      onChange(updated)
      setEditing(false)
    } catch (err) {
      setEditError(err instanceof ApiError ? err.message : 'No se pudo actualizar el préstamo')
    } finally {
      setEditBusy(false)
    }
  }

  async function handleDelete() {
    if (!token) return
    if (!confirm(`¿Eliminar el préstamo "${loan.name}"? También se eliminan sus pagos registrados.`)) return
    try {
      await api.deleteLoan(token, loan.id)
      onDeleted(loan.id)
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'No se pudo eliminar el préstamo')
    }
  }

  const next = loan.nextInstallment

  return (
    <Card className="loan-row">
      <div className="loan-row-header">
        <div>
          <h3>
            {loan.name}{' '}
            {!active && <Badge tone="ok">Pagado</Badge>}
            {dueIn !== null && dueIn <= DUE_SOON_DAYS && (
              <Badge tone="warn">{dueIn === 0 ? 'Vence hoy' : `Vence en ${dueIn} d`}</Badge>
            )}
          </h3>
          <span className="loan-meta">
            Cuota {loan.installmentsPaid}/{loan.installmentsTotal}
            {loan.dueDay && ` · vence el día ${loan.dueDay}`}
            {loan.interestRate !== null && ` · ${loan.interestRate}% E.A. (≈ ${loan.monthlyRate}% mensual)`}
          </span>
        </div>
        {!editing && (
          <div className="loan-row-actions">
            {active && (
              <button
                type="button"
                className="icon-btn"
                title="Editar préstamo"
                aria-label={`Editar el préstamo ${loan.name}`}
                onClick={startEditing}
              >
                <Pencil size={16} />
              </button>
            )}
            <button
              type="button"
              className="icon-danger-btn"
              title="Eliminar préstamo"
              aria-label={`Eliminar el préstamo ${loan.name}`}
              onClick={handleDelete}
            >
              <Trash2 size={16} />
            </button>
          </div>
        )}
      </div>

      {editing ? (
        <Form onSubmit={handleSaveEdit}>
          <FormError>{editError}</FormError>
          <p className="ui-field-full loan-field-hint" style={{ margin: 0 }}>
            Para conciliar con el extracto del banco. Solo cambia el plan hacia adelante: no toca los pagos ya registrados.
          </p>
          <FormField label="Valor total de la cuota" htmlFor={`loan-edit-installment-${loan.id}`}>
            <input
              id={`loan-edit-installment-${loan.id}`}
              type="number"
              step="0.01"
              min="0.01"
              value={editInstallmentAmount}
              onChange={(e) => setEditInstallmentAmount(sanitizeDecimalInput(e.target.value))}
              required
            />
            <span className="loan-field-hint">Capital + interés + seguro, como la cobra el banco.</span>
          </FormField>
          <FormField label="Saldo de capital actual" htmlFor={`loan-edit-remaining-${loan.id}`}>
            <input
              id={`loan-edit-remaining-${loan.id}`}
              type="number"
              step="0.01"
              min="0"
              value={editRemaining}
              onChange={(e) => setEditRemaining(sanitizeDecimalInput(e.target.value))}
              required
            />
            <span className="loan-field-hint">El saldo pendiente que dice el extracto.</span>
          </FormField>
          <FormField label="Tasa efectiva anual % (opcional)" htmlFor={`loan-edit-rate-${loan.id}`}>
            <input
              id={`loan-edit-rate-${loan.id}`}
              type="number"
              step="0.01"
              min="0"
              value={editInterestRate}
              onChange={(e) => setEditInterestRate(sanitizeDecimalInput(e.target.value))}
            />
          </FormField>
          <FormField label="Seguro / cargos por cuota (opcional)" htmlFor={`loan-edit-insurance-${loan.id}`}>
            <input
              id={`loan-edit-insurance-${loan.id}`}
              type="number"
              step="0.01"
              min="0"
              value={editInsurance}
              onChange={(e) => setEditInsurance(sanitizeDecimalInput(e.target.value))}
            />
          </FormField>
          <div className="ui-field-full" style={{ display: 'flex', gap: '0.5rem' }}>
            <Button type="submit" disabled={editBusy}>
              {editBusy ? 'Guardando…' : 'Guardar'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setEditing(false)}>
              Cancelar
            </Button>
          </div>
        </Form>
      ) : (
        <>
          <ProgressBar value={loan.percentPaid} tone={active ? 'accent' : 'ok'} height={8} />
          <div className="loan-amounts">
            <span>
              <Money amount={loan.remainingBalance} currency={loan.currency} /> saldo de capital
            </span>
            <span className="loan-percent">{loan.percentPaid}% pagado</span>
          </div>
          <div className="loan-amounts">
            <span>
              Original <Money amount={loan.principal} currency={loan.currency} />
            </span>
            <span>
              Cuota <Money amount={loan.installmentAmount} currency={loan.currency} />
            </span>
          </div>
          {active && next && (
            <p className="loan-next">
              Próxima cuota ≈ <strong>{fmt(next.total)}</strong>: capital {fmt(next.principal)}
              {next.interest > 0 && ` + interés ${fmt(next.interest)}`}
              {next.insurance > 0 && ` + seguro ${fmt(next.insurance)}`}
            </p>
          )}
          {active && (
            <div className="loan-row-pay">
              <Button variant="secondary" onClick={() => setPaying(true)}>
                Pagar cuota
              </Button>
            </div>
          )}
        </>
      )}

      <Modal open={paying} onClose={() => setPaying(false)} title={`Pagar cuota · ${loan.name}`}>
        <LoanPaymentForm
          loan={loan}
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

export function LoansPage() {
  const { token } = useAuth()
  const [loans, setLoans] = useState<Loan[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showPaidOff, setShowPaidOff] = useState(false)

  const { open: showForm, toggle: toggleForm, close: closeForm } = useCreateFormToggle()

  useEffect(() => {
    if (!token) return
    Promise.all([api.getLoans(token), api.getAccounts(token)])
      .then(([l, a]) => {
        setLoans(l)
        setAccounts(a)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Error al cargar préstamos'))
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

  function handleCreated(loan: Loan) {
    setLoans((prev) => [loan, ...prev])
    closeForm()
  }

  function updateOne(updated: Loan) {
    setLoans((prev) => prev.map((l) => (l.id === updated.id ? updated : l)))
    // Pagar una cuota saca dinero de una cuenta: refrescar saldos.
    if (token) api.getAccounts(token).then(setAccounts).catch(() => {})
  }

  function removeOne(id: string) {
    setLoans((prev) => prev.filter((l) => l.id !== id))
    if (token) api.getAccounts(token).then(setAccounts).catch(() => {})
  }

  const activeLoans = loans.filter((l) => l.status !== 'PAID_OFF')
  const paidOffLoans = loans.filter((l) => l.status === 'PAID_OFF')

  const renderRow = (loan: Loan) => (
    <LoanRow key={loan.id} loan={loan} accounts={accounts} onChange={updateOne} onDeleted={removeOne} />
  )

  return (
    <Layout fabActions={[{ label: 'Nuevo préstamo', icon: Landmark, onClick: toggleForm }]}>
      <SectionHeader as="h1" title="Préstamos">
        <Button className="toolbar-create-btn" onClick={toggleForm}>
          + Nuevo préstamo
        </Button>
      </SectionHeader>

      <Modal open={showForm} onClose={closeForm} title="Nuevo préstamo">
        <LoanForm accounts={accounts} onCreated={handleCreated} />
      </Modal>

      {loading && <p>Cargando…</p>}
      {error && <div className="auth-error">{error}</div>}

      {!loading && !error && loans.length === 0 && <EmptyState>Todavía no tienes préstamos registrados.</EmptyState>}

      {activeLoans.length > 0 && (
        <SummaryGrid label="Resumen de préstamos">
          {summarize(loans).map((g) => {
            const percentPaid = g.principal > 0 ? ((g.principal - g.remaining) / g.principal) * 100 : 0
            return (
              <SummaryCard
                key={g.currency}
                label={`${g.currency} · Lo que debes en préstamos`}
                main={
                  <>
                    <Money amount={g.remaining} currency={g.currency} tone="negative" size="lg" />
                    <span>
                      de <Money amount={g.principal} currency={g.currency} />
                    </span>
                  </>
                }
                progress={{ value: percentPaid, tone: 'accent' }}
                footLeft={
                  <>
                    Pagas ≈ <Money amount={g.monthly} currency={g.currency} /> al mes
                  </>
                }
                footRight={
                  <>
                    {g.count} préstamo{g.count !== 1 ? 's' : ''}
                    {g.dueSoon > 0 && (
                      <Badge tone="warn">
                        {g.dueSoon} vence{g.dueSoon !== 1 ? 'n' : ''} pronto
                      </Badge>
                    )}
                  </>
                }
              />
            )
          })}
        </SummaryGrid>
      )}

      {activeLoans.length > 0 && <div className="loan-list">{activeLoans.map(renderRow)}</div>}

      {paidOffLoans.length > 0 && (
        <section className="loan-paid-section">
          <button type="button" className="loan-paid-toggle" onClick={() => setShowPaidOff((v) => !v)} aria-expanded={showPaidOff}>
            Pagados ({paidOffLoans.length})
            <ChevronDown size={16} className={`loan-paid-chevron ${showPaidOff ? 'open' : ''}`} />
          </button>
          {showPaidOff && <div className="loan-list">{paidOffLoans.map(renderRow)}</div>}
        </section>
      )}
    </Layout>
  )
}
