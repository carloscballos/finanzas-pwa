import { useEffect, useState, type FormEvent } from 'react'
import { Layout } from '../components/Layout'
import { UserAutocomplete } from '../components/UserAutocomplete'
import { useAuth } from '../context/AuthContext'
import * as api from '../lib/api'
import { ApiError, type Debt, type DebtDirection } from '../lib/api'
import { CURRENCIES, DEFAULT_CURRENCY } from '../lib/currencies'
import { formatMoney } from '../lib/money'
import './DebtsPage.css'

function statusBadge(debt: Debt) {
  if (debt.status === 'SETTLED') return { label: 'Liquidada', className: 'badge-ok' }
  if (debt.status === 'PAID_PENDING_CONFIRMATION') return { label: 'Esperando confirmación', className: 'badge-warn' }
  return { label: 'Pendiente', className: 'badge-neutral' }
}

function DebtCard({ debt, onChange, onDeleted }: { debt: Debt; onChange: (d: Debt) => void; onDeleted: (id: string) => void }) {
  const { token } = useAuth()
  const [busy, setBusy] = useState(false)
  const badge = statusBadge(debt)
  const owed = debt.direction === 'THEY_OWE_ME'

  async function run(action: (t: string, id: string) => Promise<Debt>) {
    if (!token) return
    setBusy(true)
    try {
      const updated = await action(token, debt.id)
      onChange(updated)
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'No se pudo actualizar la deuda')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!token) return
    if (!confirm('¿Eliminar esta deuda pendiente?')) return
    try {
      await api.deleteDebt(token, debt.id)
      onDeleted(debt.id)
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'No se pudo eliminar la deuda')
    }
  }

  return (
    <div className="debt-card">
      <div className="debt-card-header">
        <div>
          <div className="debt-party">
            {owed ? `${debt.counterparty.name} te debe` : `Le debes a ${debt.counterparty.name}`}
          </div>
          {debt.description && <div className="debt-description">{debt.description}</div>}
        </div>
        <span className={`debt-amount ${owed ? 'owed' : 'owe'}`}>
          {formatMoney(debt.amount, debt.currency)}
        </span>
      </div>

      <div className="debt-actions">
        <span className={`badge ${badge.className}`}>{badge.label}</span>

        {debt.status === 'PENDING' && (
          <>
            <button className="btn btn-secondary" disabled={busy} onClick={() => run(api.markDebtPaid)}>
              Marcar como pagada
            </button>
            {debt.createdByMe && (
              <button className="link-danger" onClick={handleDelete}>
                Eliminar
              </button>
            )}
          </>
        )}

        {debt.status === 'PAID_PENDING_CONFIRMATION' &&
          (debt.markedPaidByMe ? (
            <span className="debt-waiting">Esperando que {debt.counterparty.name} confirme</span>
          ) : (
            <>
              <button className="btn" disabled={busy} onClick={() => run(api.confirmDebt)}>
                Confirmar pago
              </button>
              <button className="btn btn-secondary" disabled={busy} onClick={() => run(api.rejectDebt)}>
                Rechazar
              </button>
            </>
          ))}

        {debt.status === 'SETTLED' && debt.settledAt && (
          <span className="debt-settled">
            Liquidada el {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(debt.settledAt))}
          </span>
        )}
      </div>
    </div>
  )
}

export function DebtsPage() {
  const { token } = useAuth()
  const [debts, setDebts] = useState<Debt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [counterpartyEmail, setCounterpartyEmail] = useState('')
  const [direction, setDirection] = useState<DebtDirection>('THEY_OWE_ME')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY)
  const [description, setDescription] = useState('')
  const [creating, setCreating] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    api
      .getDebts(token)
      .then(setDebts)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Error al cargar deudas'))
      .finally(() => setLoading(false))
  }, [token])

  async function handleCreate(event: FormEvent) {
    event.preventDefault()
    if (!token) return
    setFormError(null)
    setCreating(true)
    try {
      const debt = await api.createDebt(token, {
        counterpartyEmail,
        direction,
        amount: Number(amount),
        currency,
        description: description || undefined,
      })
      setDebts((prev) => [debt, ...prev])
      setCounterpartyEmail('')
      setAmount('')
      setCurrency(DEFAULT_CURRENCY)
      setDescription('')
      setShowForm(false)
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'No se pudo crear la deuda')
    } finally {
      setCreating(false)
    }
  }

  function updateOne(updated: Debt) {
    setDebts((prev) => prev.map((d) => (d.id === updated.id ? updated : d)))
  }

  function removeOne(id: string) {
    setDebts((prev) => prev.filter((d) => d.id !== id))
  }

  return (
    <Layout>
      <div className="debts-toolbar">
        <h1>Deudas</h1>
        <button className="btn" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancelar' : '+ Nueva deuda'}
        </button>
      </div>

      {showForm && (
        <form className="create-form" onSubmit={handleCreate}>
          {formError && (
            <div className="auth-error field-full" style={{ margin: 0 }}>
              {formError}
            </div>
          )}
          <div className="debts-direction-toggle">
            <button
              type="button"
              className={direction === 'THEY_OWE_ME' ? 'active-owed' : ''}
              onClick={() => setDirection('THEY_OWE_ME')}
            >
              Me deben
            </button>
            <button
              type="button"
              className={direction === 'I_OWE_THEM' ? 'active-owe' : ''}
              onClick={() => setDirection('I_OWE_THEM')}
            >
              Yo debo
            </button>
          </div>
          <div className="field field-full">
            <label htmlFor="debt-email">Email de la otra persona</label>
            <UserAutocomplete
              id="debt-email"
              value={counterpartyEmail}
              onChange={setCounterpartyEmail}
              placeholder="alguien@example.com"
            />
          </div>
          <div className="field">
            <label htmlFor="debt-amount">Monto</label>
            <input
              id="debt-amount"
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="debt-currency">Moneda</label>
            <select
              id="debt-currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value as typeof currency)}
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} · {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field field-full">
            <label htmlFor="debt-description">Descripción (opcional)</label>
            <input
              id="debt-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Cena del viernes"
            />
          </div>
          <button className="btn" type="submit" disabled={creating}>
            {creating ? 'Creando…' : 'Crear deuda'}
          </button>
        </form>
      )}

      {loading && <p>Cargando…</p>}
      {error && <div className="auth-error">{error}</div>}

      {!loading && !error && debts.length === 0 && (
        <p className="accounts-empty">No tienes deudas registradas.</p>
      )}

      <div className="debts-list">
        {debts.map((debt) => (
          <DebtCard key={debt.id} debt={debt} onChange={updateOne} onDeleted={removeOne} />
        ))}
      </div>
    </Layout>
  )
}
