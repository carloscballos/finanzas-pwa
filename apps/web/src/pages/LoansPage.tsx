import { useEffect, useState, type FormEvent } from 'react'
import { Landmark } from 'lucide-react'
import { Layout } from '../components/Layout'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { CardGrid } from '../components/ui/CardGrid'
import { EmptyState } from '../components/ui/EmptyState'
import { Form, FormField, FormError } from '../components/ui/Form'
import { Money } from '../components/ui/Money'
import { ProgressBar } from '../components/ui/ProgressBar'
import { SectionHeader } from '../components/ui/SectionHeader'
import { useCreateFormToggle } from '../components/ui/useCreateFormToggle'
import { useAuth } from '../context/AuthContext'
import * as api from '../lib/api'
import { ApiError, type Account, type Loan } from '../lib/api'
import { CURRENCIES, DEFAULT_CURRENCY } from '../lib/currencies'
import { formatMoney } from '../lib/money'
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
  const matchingAccounts = accounts.filter((a) => a.currency === loan.currency)
  const [accountId, setAccountId] = useState(loan.account?.id ?? '')
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)

  async function handlePay(event: FormEvent) {
    event.preventDefault()
    if (!token || !accountId) return
    setBusy(true)
    try {
      const updated = await api.payLoanInstallment(token, loan.id, {
        accountId,
        amount: amount ? Number(amount) : undefined,
      })
      onChange(updated)
      setAmount('')
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
            {loan.interestRate !== null && ` · ${loan.interestRate}% anual`}
          </span>
        </div>
        <button className="link-danger" onClick={handleDelete}>
          Eliminar
        </button>
      </div>
      <ProgressBar value={loan.percentPaid} tone="accent" />
      <div className="loan-amounts">
        <span>
          <Money amount={loan.remainingBalance} currency={loan.currency} /> pendiente
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
              placeholder={`Monto (cuota ${formatMoney(loan.installmentAmount, loan.currency)})`}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
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
  const [name, setName] = useState('')
  const [principal, setPrincipal] = useState('')
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY)
  const [interestRate, setInterestRate] = useState('')
  const [installmentsTotal, setInstallmentsTotal] = useState('')
  const [installmentAmount, setInstallmentAmount] = useState('')
  const [dueDay, setDueDay] = useState('')
  const [accountId, setAccountId] = useState('')
  const [installmentsPaid, setInstallmentsPaid] = useState('')
  const [creating, setCreating] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

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

  async function handleCreate(event: FormEvent) {
    event.preventDefault()
    if (!token) return
    setFormError(null)
    setCreating(true)
    try {
      const loan = await api.createLoan(token, {
        name,
        principal: Number(principal),
        currency: accountId ? undefined : currency,
        interestRate: interestRate ? Number(interestRate) : undefined,
        installmentsTotal: Number(installmentsTotal),
        installmentAmount: Number(installmentAmount),
        dueDay: dueDay ? Number(dueDay) : undefined,
        accountId: accountId || undefined,
        installmentsPaid: installmentsPaid ? Number(installmentsPaid) : undefined,
      })
      setLoans((prev) => [loan, ...prev])
      setName('')
      setPrincipal('')
      setCurrency(DEFAULT_CURRENCY)
      setInterestRate('')
      setInstallmentsTotal('')
      setInstallmentAmount('')
      setDueDay('')
      setAccountId('')
      setInstallmentsPaid('')
      closeForm()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'No se pudo crear el préstamo')
    } finally {
      setCreating(false)
    }
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
        <Button className={showForm ? '' : 'toolbar-create-btn'} onClick={toggleForm}>
          {showForm ? 'Cancelar' : '+ Nuevo préstamo'}
        </Button>
      </SectionHeader>

      {showForm && (
        <Card className="ui-form-card">
          <Form onSubmit={handleCreate}>
            <FormError>{formError}</FormError>
            <FormField label="Nombre" htmlFor="loan-name" full>
              <input
                id="loan-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Préstamo carro"
              />
            </FormField>
            <FormField label="Monto original" htmlFor="loan-principal">
              <input
                id="loan-principal"
                type="number"
                step="0.01"
                min="0.01"
                value={principal}
                onChange={(e) => setPrincipal(e.target.value)}
                required
              />
            </FormField>
            <FormField label="Moneda" htmlFor="loan-currency">
              {accountId ? (
                <input id="loan-currency" value={accounts.find((a) => a.id === accountId)?.currency ?? ''} disabled />
              ) : (
                <select id="loan-currency" value={currency} onChange={(e) => setCurrency(e.target.value as typeof currency)}>
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} · {c.label}
                    </option>
                  ))}
                </select>
              )}
            </FormField>
            <FormField label="Número de cuotas" htmlFor="loan-installments">
              <input
                id="loan-installments"
                type="number"
                min="1"
                step="1"
                value={installmentsTotal}
                onChange={(e) => setInstallmentsTotal(e.target.value)}
                required
              />
            </FormField>
            <FormField label="Monto de cada cuota" htmlFor="loan-installment-amount">
              <input
                id="loan-installment-amount"
                type="number"
                step="0.01"
                min="0.01"
                value={installmentAmount}
                onChange={(e) => setInstallmentAmount(e.target.value)}
                required
              />
            </FormField>
            <FormField label="Cuotas ya pagadas (opcional)" htmlFor="loan-installments-paid">
              <input
                id="loan-installments-paid"
                type="number"
                min="0"
                step="1"
                placeholder="0"
                value={installmentsPaid}
                onChange={(e) => setInstallmentsPaid(e.target.value)}
              />
              <span style={{ fontSize: '0.8rem' }}>Úsalo para traer un préstamo que ya venía en curso.</span>
            </FormField>
            <FormField label="Tasa de interés anual % (opcional)" htmlFor="loan-rate">
              <input
                id="loan-rate"
                type="number"
                step="0.01"
                min="0"
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
              />
            </FormField>
            <FormField label="Día de pago (opcional)" htmlFor="loan-due-day">
              <input
                id="loan-due-day"
                type="number"
                min="1"
                max="31"
                value={dueDay}
                onChange={(e) => setDueDay(e.target.value)}
                placeholder="1-31"
              />
            </FormField>
            <FormField label="Cuenta de pago (opcional)" htmlFor="loan-account">
              <select id="loan-account" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                <option value="">Sin preseleccionar</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.currency})
                  </option>
                ))}
              </select>
            </FormField>
            <Button type="submit" disabled={creating}>
              {creating ? 'Creando…' : 'Crear préstamo'}
            </Button>
          </Form>
        </Card>
      )}

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
