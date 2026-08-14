import { useEffect, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Landmark } from 'lucide-react'
import { Layout } from '../components/Layout'
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
    <div className="loan-card">
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
      <div className="loan-bar-track">
        <div className="loan-bar-fill" style={{ width: `${Math.min(loan.percentPaid, 100)}%` }} />
      </div>
      <div className="loan-amounts">
        <span>{formatMoney(loan.remainingBalance, loan.currency)} pendiente</span>
        <span>{loan.percentPaid}% pagado</span>
      </div>
      <div className="loan-amounts">
        <span>Original {formatMoney(loan.principal, loan.currency)}</span>
        <span className={`badge ${loan.status === 'PAID_OFF' ? 'badge-ok' : 'badge-neutral'}`}>
          {loan.status === 'PAID_OFF' ? 'Pagado' : 'Activo'}
        </span>
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
            <button className="btn" type="submit" disabled={busy || !accountId}>
              Pagar cuota
            </button>
          </form>
        ))}
    </div>
  )
}

export function LoansPage() {
  const { token } = useAuth()
  const [searchParams] = useSearchParams()
  const [loans, setLoans] = useState<Loan[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(searchParams.get('new') === '1')
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
      setShowForm(false)
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
    <Layout fabActions={[{ label: 'Nuevo préstamo', icon: Landmark, onClick: () => setShowForm(true) }]}>
      <div className="loans-toolbar">
        <h1>Préstamos</h1>
        <button
          className={`btn ${showForm ? '' : 'toolbar-create-btn'}`}
          onClick={() => setShowForm((v) => !v)}
        >
          {showForm ? 'Cancelar' : '+ Nuevo préstamo'}
        </button>
      </div>

      {showForm && (
        <form className="create-form" onSubmit={handleCreate}>
          {formError && (
            <div className="auth-error field-full" style={{ margin: 0 }}>
              {formError}
            </div>
          )}
          <div className="field field-full">
            <label htmlFor="loan-name">Nombre</label>
            <input
              id="loan-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Préstamo carro"
            />
          </div>
          <div className="field">
            <label htmlFor="loan-principal">Monto original</label>
            <input
              id="loan-principal"
              type="number"
              step="0.01"
              min="0.01"
              value={principal}
              onChange={(e) => setPrincipal(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="loan-currency">Moneda</label>
            {accountId ? (
              <input
                id="loan-currency"
                value={accounts.find((a) => a.id === accountId)?.currency ?? ''}
                disabled
              />
            ) : (
              <select
                id="loan-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value as typeof currency)}
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} · {c.label}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="field">
            <label htmlFor="loan-installments">Número de cuotas</label>
            <input
              id="loan-installments"
              type="number"
              min="1"
              step="1"
              value={installmentsTotal}
              onChange={(e) => setInstallmentsTotal(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="loan-installment-amount">Monto de cada cuota</label>
            <input
              id="loan-installment-amount"
              type="number"
              step="0.01"
              min="0.01"
              value={installmentAmount}
              onChange={(e) => setInstallmentAmount(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="loan-installments-paid">Cuotas ya pagadas (opcional)</label>
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
          </div>
          <div className="field">
            <label htmlFor="loan-rate">Tasa de interés anual % (opcional)</label>
            <input
              id="loan-rate"
              type="number"
              step="0.01"
              min="0"
              value={interestRate}
              onChange={(e) => setInterestRate(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="loan-due-day">Día de pago (opcional)</label>
            <input
              id="loan-due-day"
              type="number"
              min="1"
              max="31"
              value={dueDay}
              onChange={(e) => setDueDay(e.target.value)}
              placeholder="1-31"
            />
          </div>
          <div className="field">
            <label htmlFor="loan-account">Cuenta de pago (opcional)</label>
            <select id="loan-account" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">Sin preseleccionar</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.currency})
                </option>
              ))}
            </select>
          </div>
          <button className="btn" type="submit" disabled={creating}>
            {creating ? 'Creando…' : 'Crear préstamo'}
          </button>
        </form>
      )}

      {loading && <p>Cargando…</p>}
      {error && <div className="auth-error">{error}</div>}

      {!loading && !error && loans.length === 0 && (
        <p className="accounts-empty">Todavía no tienes préstamos registrados.</p>
      )}

      <div className="loans-grid">
        {loans.map((loan) => (
          <LoanCard key={loan.id} loan={loan} accounts={accounts} onChange={updateOne} onDeleted={removeOne} />
        ))}
      </div>
    </Layout>
  )
}
