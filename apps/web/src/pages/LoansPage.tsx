import { useEffect, useState, type FormEvent } from 'react'
import { Landmark } from 'lucide-react'
import { LoanForm } from '../components/LoanForm'
import { Layout } from '../components/Layout'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { CardGrid } from '../components/ui/CardGrid'
import { EmptyState } from '../components/ui/EmptyState'
import { FormError } from '../components/ui/Form'
import { Modal } from '../components/ui/Modal'
import { Money } from '../components/ui/Money'
import { ProgressBar } from '../components/ui/ProgressBar'
import { SectionHeader } from '../components/ui/SectionHeader'
import { useCreateFormToggle } from '../components/ui/useCreateFormToggle'
import { useAuth } from '../context/AuthContext'
import * as api from '../lib/api'
import { ApiError, type Account, type Loan } from '../lib/api'
import { dateTimeInputToIso, nowDateTimeInput } from '../lib/dates'
import { formatMoneyMaybeHidden, sanitizeDecimalInput } from '../lib/money'
import { usePrivacy } from '../context/PrivacyContext'
import './LoansPage.css'

function LoanCard({
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
  const matchingAccounts = accounts.filter((a) => a.currency === loan.currency)
  const next = loan.nextInstallment
  const fmt = (value: number) => formatMoneyMaybeHidden(value, loan.currency, hideValues)

  const [accountId, setAccountId] = useState(loan.account?.id ?? '')
  const [amount, setAmount] = useState('')
  const [principalAmount, setPrincipalAmount] = useState('')
  const [payDate, setPayDate] = useState(nowDateTimeInput)
  const [busy, setBusy] = useState(false)

  const [editing, setEditing] = useState(false)
  const [editInstallmentAmount, setEditInstallmentAmount] = useState('')
  const [editInterestRate, setEditInterestRate] = useState('')
  const [editInsurance, setEditInsurance] = useState('')
  const [editRemaining, setEditRemaining] = useState('')
  const [editBusy, setEditBusy] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

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

  async function handlePay(event: FormEvent) {
    event.preventDefault()
    if (!token || !accountId) return
    setBusy(true)
    try {
      const updated = await api.payLoanInstallment(token, loan.id, {
        accountId,
        amount: amount ? Number(amount) : undefined,
        principalAmount: principalAmount ? Number(principalAmount) : undefined,
        occurredAt: dateTimeInputToIso(payDate),
      })
      onChange(updated)
      setAmount('')
      setPrincipalAmount('')
      setPayDate(nowDateTimeInput())
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'No se pudo registrar el pago')
    } finally {
      setBusy(false)
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

  return (
    <Card>
      <div className="loan-card-header">
        <div>
          <h3>{loan.name}</h3>
          <span className="loan-meta">
            Cuota {loan.installmentsPaid}/{loan.installmentsTotal}
            {loan.dueDay && ` · vence el día ${loan.dueDay}`}
            {loan.interestRate !== null && ` · ${loan.interestRate}% E.A. (≈ ${loan.monthlyRate}% mensual)`}
          </span>
        </div>
        <div className="loan-card-actions">
          {loan.status !== 'PAID_OFF' && (
            <button className="link" onClick={editing ? () => setEditing(false) : startEditing}>
              {editing ? 'Cancelar' : 'Editar'}
            </button>
          )}
          <button className="link-danger" onClick={handleDelete}>
            Eliminar
          </button>
        </div>
      </div>
      <ProgressBar value={loan.percentPaid} tone="accent" />
      <div className="loan-amounts">
        <span>
          <Money amount={loan.remainingBalance} currency={loan.currency} /> saldo de capital
        </span>
        <span>{loan.percentPaid}% pagado</span>
      </div>
      <div className="loan-amounts">
        <span>
          Original <Money amount={loan.principal} currency={loan.currency} />
        </span>
        <Badge tone={loan.status === 'PAID_OFF' ? 'ok' : 'neutral'}>
          {loan.status === 'PAID_OFF' ? 'Pagado' : 'Activo'}
        </Badge>
      </div>
      {next && (
        <p className="loan-next">
          Próxima cuota ≈ <strong>{fmt(next.total)}</strong>: capital {fmt(next.principal)}
          {next.interest > 0 && ` + interés ${fmt(next.interest)}`}
          {next.insurance > 0 && ` + seguro ${fmt(next.insurance)}`}
        </p>
      )}

      {editing && (
        <form className="loan-pay" onSubmit={handleSaveEdit}>
          <FormError>{editError}</FormError>
          <input
            type="number"
            step="0.01"
            min="0.01"
            aria-label="Valor total de la cuota"
            placeholder="Valor total de la cuota"
            title="Valor total de la cuota según el extracto (capital + interés + seguro)"
            value={editInstallmentAmount}
            onChange={(e) => setEditInstallmentAmount(sanitizeDecimalInput(e.target.value))}
            required
          />
          <input
            type="number"
            step="0.01"
            min="0"
            aria-label="Tasa efectiva anual %"
            placeholder="% E.A. (opcional)"
            title="Tasa de interés efectiva anual"
            value={editInterestRate}
            onChange={(e) => setEditInterestRate(sanitizeDecimalInput(e.target.value))}
          />
          <input
            type="number"
            step="0.01"
            min="0"
            aria-label="Seguro por cuota"
            placeholder="Seguro por cuota (opcional)"
            title="Seguro de vida / cargos fijos incluidos en la cuota"
            value={editInsurance}
            onChange={(e) => setEditInsurance(sanitizeDecimalInput(e.target.value))}
          />
          <input
            type="number"
            step="0.01"
            min="0"
            aria-label="Saldo de capital actual"
            placeholder="Saldo de capital"
            title="Saldo de capital pendiente según el extracto"
            value={editRemaining}
            onChange={(e) => setEditRemaining(sanitizeDecimalInput(e.target.value))}
            required
          />
          <Button type="submit" disabled={editBusy}>
            Guardar
          </Button>
        </form>
      )}

      {loan.status !== 'PAID_OFF' &&
        (matchingAccounts.length === 0 ? (
          <p className="loan-no-account">
            No tienes cuentas en {loan.currency} — crea una para poder pagar cuotas.
          </p>
        ) : (
          <form className="loan-pay" onSubmit={handlePay}>
            <select
              aria-label="Cuenta de pago"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              required
            >
              <option value="" disabled>
                Cuenta
              </option>
              {matchingAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <input
              type="number"
              step="0.01"
              min="0.01"
              aria-label="Total pagado"
              placeholder={next ? `Total (≈ ${fmt(next.total)})` : 'Total pagado'}
              title="Lo que salió de la cuenta. Vacío = la próxima cuota del plan"
              value={amount}
              onChange={(e) => setAmount(sanitizeDecimalInput(e.target.value))}
            />
            <input
              type="number"
              step="0.01"
              min="0"
              aria-label="Abono a capital"
              placeholder={next ? `Capital (≈ ${fmt(next.principal)})` : 'Capital (opcional)'}
              title="Abono a capital según el extracto. Vacío = total − interés del período − seguro"
              value={principalAmount}
              onChange={(e) => setPrincipalAmount(sanitizeDecimalInput(e.target.value))}
            />
            <input
              type="datetime-local"
              aria-label="Fecha y hora del pago"
              value={payDate}
              onChange={(e) => setPayDate(e.target.value)}
              required
            />
            <Button type="submit" disabled={busy || !accountId}>
              Pagar cuota
            </Button>
          </form>
        ))}
    </Card>
  )
}

export function LoansPage() {
  const { token } = useAuth()
  const [loans, setLoans] = useState<Loan[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  function handleCreated(loan: Loan) {
    setLoans((prev) => [loan, ...prev])
    closeForm()
  }

  function updateOne(updated: Loan) {
    setLoans((prev) => prev.map((l) => (l.id === updated.id ? updated : l)))
  }

  function removeOne(id: string) {
    setLoans((prev) => prev.filter((l) => l.id !== id))
  }

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

      <CardGrid>
        {loans.map((loan) => (
          <LoanCard key={loan.id} loan={loan} accounts={accounts} onChange={updateOne} onDeleted={removeOne} />
        ))}
      </CardGrid>
    </Layout>
  )
}
