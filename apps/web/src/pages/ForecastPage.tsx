import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { useAuth } from '../context/AuthContext'
import * as api from '../lib/api'
import {
  ApiError,
  type Account,
  type BudgetSuggestion,
  type Category,
  type ForecastSummary,
  type RecurrenceFrequency,
  type RecurringTransaction,
  type TransactionType,
} from '../lib/api'
import { formatMoney } from '../lib/money'
import './ForecastPage.css'

const FREQUENCY_LABELS: Record<RecurrenceFrequency, string> = {
  WEEKLY: 'Semanal',
  SEMIMONTHLY: 'Quincenal',
  MONTHLY: 'Mensual',
  YEARLY: 'Anual',
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(iso))
}

export function ForecastPage() {
  const { token } = useAuth()
  const [summary, setSummary] = useState<ForecastSummary[]>([])
  const [suggestions, setSuggestions] = useState<BudgetSuggestion[]>([])
  const [recurring, setRecurring] = useState<RecurringTransaction[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creatingBudgetFor, setCreatingBudgetFor] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [accountId, setAccountId] = useState('')
  const [type, setType] = useState<TransactionType>('EXPENSE')
  const [categoryId, setCategoryId] = useState('')
  const [amount, setAmount] = useState('')
  const [frequency, setFrequency] = useState<RecurrenceFrequency>('MONTHLY')
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [note, setNote] = useState('')
  const [creating, setCreating] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  function loadAll() {
    if (!token) return
    Promise.all([
      api.getForecastSummary(token),
      api.getBudgetSuggestions(token),
      api.getRecurringTransactions(token),
      api.getAccounts(token),
      api.getCategories(token),
    ])
      .then(([s, sug, r, a, c]) => {
        setSummary(s)
        setSuggestions(sug)
        setRecurring(r)
        setAccounts(a)
        setCategories(c)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Error al cargar la proyección'))
      .finally(() => setLoading(false))
  }

  useEffect(loadAll, [token])

  const categoriesForType = categories.filter((c) => c.type === type)

  async function handleCreate(event: FormEvent) {
    event.preventDefault()
    if (!token) return
    if (!accountId || !categoryId) {
      setFormError('Elige cuenta y categoría')
      return
    }
    setFormError(null)
    setCreating(true)
    try {
      const item = await api.createRecurringTransaction(token, {
        accountId,
        categoryId,
        type,
        amount: Number(amount),
        frequency,
        startDate: new Date(startDate).toISOString(),
        note: note || undefined,
      })
      setRecurring((prev) => [item, ...prev])
      setAccountId('')
      setCategoryId('')
      setAmount('')
      setNote('')
      setShowForm(false)
      loadAll()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'No se pudo crear el movimiento recurrente')
    } finally {
      setCreating(false)
    }
  }

  async function toggleActive(item: RecurringTransaction) {
    if (!token) return
    try {
      const updated = await api.updateRecurringTransaction(token, item.id, { active: !item.active })
      setRecurring((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
      setSummary(await api.getForecastSummary(token))
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'No se pudo actualizar')
    }
  }

  async function handleDelete(item: RecurringTransaction) {
    if (!token) return
    if (!confirm(`¿Eliminar el movimiento recurrente "${item.category.name}"? No borra los movimientos ya generados.`))
      return
    try {
      await api.deleteRecurringTransaction(token, item.id)
      setRecurring((prev) => prev.filter((r) => r.id !== item.id))
      setSummary(await api.getForecastSummary(token))
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'No se pudo eliminar')
    }
  }

  async function handleCreateSuggestedBudget(suggestion: BudgetSuggestion) {
    if (!token) return
    const key = `${suggestion.category.id}:${suggestion.currency}`
    setCreatingBudgetFor(key)
    try {
      await api.createBudget(token, {
        categoryId: suggestion.category.id,
        limitAmount: Math.ceil(suggestion.averageMonthlySpend),
        currency: suggestion.currency,
        period: 'MONTHLY',
      })
      const refreshed = await api.getBudgetSuggestions(token)
      setSuggestions(refreshed)
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'No se pudo crear el presupuesto')
    } finally {
      setCreatingBudgetFor(null)
    }
  }

  return (
    <Layout>
      <div className="debts-toolbar">
        <h1>Proyección</h1>
        <button className="btn" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancelar' : '+ Nuevo recurrente'}
        </button>
      </div>

      {loading && <p>Cargando…</p>}
      {error && <div className="auth-error">{error}</div>}

      {showForm && (
        <form className="create-form" onSubmit={handleCreate}>
          {formError && (
            <div className="auth-error field-full" style={{ margin: 0 }}>
              {formError}
            </div>
          )}
          <div className="recurring-type-toggle">
            <button
              type="button"
              className={type === 'EXPENSE' ? 'active-expense' : ''}
              onClick={() => {
                setType('EXPENSE')
                setCategoryId('')
              }}
            >
              Gasto
            </button>
            <button
              type="button"
              className={type === 'INCOME' ? 'active-income' : ''}
              onClick={() => {
                setType('INCOME')
                setCategoryId('')
              }}
            >
              Ingreso
            </button>
          </div>
          <div className="field">
            <label htmlFor="rt-account">Cuenta</label>
            <select id="rt-account" value={accountId} onChange={(e) => setAccountId(e.target.value)} required>
              <option value="" disabled>
                Elige una
              </option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.currency})
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="rt-category">Categoría</label>
            <select
              id="rt-category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              required
            >
              <option value="" disabled>
                Elige una
              </option>
              {categoriesForType.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.emoji ? `${c.emoji} ` : ''}
                  {c.name}
                </option>
              ))}
            </select>
            {categoriesForType.length === 0 && (
              <span style={{ fontSize: '0.8rem' }}>
                No tienes categorías de {type === 'EXPENSE' ? 'gasto' : 'ingreso'} — créalas en{' '}
                <Link to="/categories">Categorías</Link>
              </span>
            )}
          </div>
          <div className="field">
            <label htmlFor="rt-amount">Monto</label>
            <input
              id="rt-amount"
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="rt-frequency">Frecuencia</label>
            <select
              id="rt-frequency"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as RecurrenceFrequency)}
            >
              <option value="MONTHLY">Mensual</option>
              <option value="SEMIMONTHLY">Quincenal</option>
              <option value="WEEKLY">Semanal</option>
              <option value="YEARLY">Anual</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="rt-start">Primera fecha</label>
            <input
              id="rt-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </div>
          <div className="field field-full">
            <label htmlFor="rt-note">Nota (opcional)</label>
            <input id="rt-note" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <button className="btn" type="submit" disabled={creating}>
            {creating ? 'Creando…' : 'Crear recurrente'}
          </button>
        </form>
      )}

      {!loading && !error && (
        <>
          <section className="forecast-section">
            <h2>Resumen mensual proyectado</h2>
            {summary.length === 0 ? (
              <p className="accounts-empty">
                Sin movimientos recurrentes activos todavía — créalos arriba para ver una proyección.
              </p>
            ) : (
              <div className="summary-cards">
                {summary.map((s) => (
                  <div className="summary-card" key={s.currency}>
                    <div className="summary-card-currency">{s.currency}</div>
                    <div className="summary-row">
                      <span>Ingreso recurrente</span>
                      <span className="income">{formatMoney(s.projectedMonthlyIncome, s.currency)}</span>
                    </div>
                    <div className="summary-row">
                      <span>Gasto recurrente</span>
                      <span className="expense">{formatMoney(s.projectedMonthlyExpense, s.currency)}</span>
                    </div>
                    <div className="summary-row net">
                      <span>Neto mensual</span>
                      <span>{formatMoney(s.projectedMonthlyNet, s.currency)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="forecast-section">
            <h2>Movimientos recurrentes</h2>
            {recurring.length === 0 ? (
              <p className="accounts-empty">No tienes movimientos recurrentes.</p>
            ) : (
              <div className="recurring-list">
                {recurring.map((item) => (
                  <div className={`recurring-row ${item.active ? '' : 'paused'}`} key={item.id}>
                    {item.category.emoji && <span>{item.category.emoji}</span>}
                    <div className="recurring-row-main">
                      <div className="recurring-row-category">{item.category.name}</div>
                      <div className="recurring-row-meta">
                        {item.account.name} · {FREQUENCY_LABELS[item.frequency]} · Próxima:{' '}
                        {formatDate(item.nextRunDate)}
                        {!item.active && ' · Pausado'}
                      </div>
                    </div>
                    <span className={`recurring-row-amount ${item.type === 'INCOME' ? 'income' : 'expense'}`}>
                      {item.type === 'INCOME' ? '+' : '-'}
                      {formatMoney(item.amount, item.account.currency)}
                    </span>
                    <div className="recurring-row-actions">
                      <button className="btn btn-secondary" onClick={() => toggleActive(item)}>
                        {item.active ? 'Pausar' : 'Reactivar'}
                      </button>
                      <button className="link-danger" onClick={() => handleDelete(item)}>
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="forecast-section">
            <h2>Presupuestos sugeridos</h2>
            <p className="recurring-row-meta" style={{ marginBottom: '0.75rem' }}>
              Basado en tu gasto real promedio de los últimos 3 meses completos.
            </p>
            {suggestions.length === 0 ? (
              <p className="accounts-empty">
                Todavía no hay suficiente historial de gastos para sugerir presupuestos.
              </p>
            ) : (
              <div className="suggestions-list">
                {suggestions.map((s) => {
                  const key = `${s.category.id}:${s.currency}`
                  return (
                    <div className="suggestion-row" key={key}>
                      {s.category.emoji && <span>{s.category.emoji}</span>}
                      <div className="suggestion-info">
                        <div className="recurring-row-category">{s.category.name}</div>
                        <div className="recurring-row-meta">
                          Promedio: {formatMoney(s.averageMonthlySpend, s.currency)}/mes
                        </div>
                      </div>
                      {s.existingBudget ? (
                        <span className="badge badge-ok">
                          Ya tienes presupuesto de {formatMoney(s.existingBudget.limitAmount, s.currency)}
                        </span>
                      ) : (
                        <button
                          className="btn"
                          disabled={creatingBudgetFor === key}
                          onClick={() => handleCreateSuggestedBudget(s)}
                        >
                          Crear presupuesto de {formatMoney(Math.ceil(s.averageMonthlySpend), s.currency)}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </>
      )}
    </Layout>
  )
}
