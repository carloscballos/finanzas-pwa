import { useEffect, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PiggyBank } from 'lucide-react'
import { Layout } from '../components/Layout'
import { useAuth } from '../context/AuthContext'
import * as api from '../lib/api'
import { ApiError, type Budget, type BudgetPeriod, type Category } from '../lib/api'
import { CURRENCIES, DEFAULT_CURRENCY } from '../lib/currencies'
import { formatMoney } from '../lib/money'
import './BudgetsPage.css'

function barClass(percentUsed: number) {
  if (percentUsed >= 100) return 'over'
  if (percentUsed >= 70) return 'warn'
  return 'ok'
}

export function BudgetsPage() {
  const { token } = useAuth()
  const [searchParams] = useSearchParams()
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(searchParams.get('new') === '1')
  const [categoryId, setCategoryId] = useState('')
  const [limitAmount, setLimitAmount] = useState('')
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY)
  const [period, setPeriod] = useState<BudgetPeriod>('MONTHLY')
  const [creating, setCreating] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    Promise.all([api.getBudgets(token), api.getCategories(token)])
      .then(([b, c]) => {
        setBudgets(b)
        setCategories(c)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Error al cargar presupuestos'))
      .finally(() => setLoading(false))
  }, [token])

  const expenseCategories = categories.filter((c) => c.type === 'EXPENSE')

  async function handleCreate(event: FormEvent) {
    event.preventDefault()
    if (!token) return
    if (!categoryId) {
      setFormError('Elige una categoría de gasto')
      return
    }
    setFormError(null)
    setCreating(true)
    try {
      const budget = await api.createBudget(token, {
        categoryId,
        limitAmount: Number(limitAmount),
        currency,
        period,
      })
      setBudgets((prev) => [...prev, budget])
      setCategoryId('')
      setLimitAmount('')
      setCurrency(DEFAULT_CURRENCY)
      setPeriod('MONTHLY')
      setShowForm(false)
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'No se pudo crear el presupuesto')
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(budget: Budget) {
    if (!token) return
    if (!confirm(`¿Eliminar el presupuesto de "${budget.category.name}"?`)) return
    try {
      await api.deleteBudget(token, budget.id)
      setBudgets((prev) => prev.filter((b) => b.id !== budget.id))
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'No se pudo eliminar el presupuesto')
    }
  }

  return (
    <Layout
      fabActions={[{ label: 'Nuevo presupuesto', icon: PiggyBank, onClick: () => setShowForm(true) }]}
    >
      <div className="budgets-toolbar">
        <h1>Presupuestos</h1>
        <button
          className={`btn ${showForm ? '' : 'toolbar-create-btn'}`}
          onClick={() => setShowForm((v) => !v)}
        >
          {showForm ? 'Cancelar' : '+ Nuevo presupuesto'}
        </button>
      </div>

      {showForm && (
        <form className="create-form" onSubmit={handleCreate}>
          {formError && (
            <div className="auth-error field-full" style={{ margin: 0 }}>
              {formError}
            </div>
          )}
          <div className="field">
            <label htmlFor="budget-category">Categoría de gasto</label>
            <select
              id="budget-category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              required
            >
              <option value="" disabled>
                Elige una
              </option>
              {expenseCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.emoji ? `${c.emoji} ` : ''}
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="budget-period">Periodo</label>
            <select
              id="budget-period"
              value={period}
              onChange={(e) => setPeriod(e.target.value as BudgetPeriod)}
            >
              <option value="MONTHLY">Mensual</option>
              <option value="WEEKLY">Semanal</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="budget-limit">Límite</label>
            <input
              id="budget-limit"
              type="number"
              step="0.01"
              min="0.01"
              value={limitAmount}
              onChange={(e) => setLimitAmount(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="budget-currency">Moneda</label>
            <select
              id="budget-currency"
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
          <button className="btn" type="submit" disabled={creating}>
            {creating ? 'Creando…' : 'Crear presupuesto'}
          </button>
        </form>
      )}

      {loading && <p>Cargando…</p>}
      {error && <div className="auth-error">{error}</div>}

      {!loading && !error && budgets.length === 0 && (
        <p className="accounts-empty">Todavía no tienes presupuestos.</p>
      )}

      <div className="budgets-grid">
        {budgets.map((budget) => (
          <div className="budget-card" key={budget.id}>
            <div className="budget-card-header">
              <div>
                <h3>
                  {budget.category.emoji ? `${budget.category.emoji} ` : ''}
                  {budget.category.name}
                </h3>
                <span className="budget-period">
                  {budget.period === 'MONTHLY' ? 'Mensual' : 'Semanal'}
                </span>
              </div>
              <button className="link-danger" onClick={() => handleDelete(budget)}>
                Eliminar
              </button>
            </div>
            <div className="budget-bar-track">
              <div
                className={`budget-bar-fill ${barClass(budget.percentUsed)}`}
                style={{ width: `${Math.min(budget.percentUsed, 100)}%` }}
              />
            </div>
            <div className="budget-amounts">
              <span>{formatMoney(budget.spent, budget.currency)} gastado</span>
              <span className="budget-percent">{budget.percentUsed}%</span>
            </div>
            <div className="budget-amounts">
              <span>Límite {formatMoney(budget.limitAmount, budget.currency)}</span>
              <span>
                {budget.remaining >= 0
                  ? `${formatMoney(budget.remaining, budget.currency)} restante`
                  : 'Excedido'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </Layout>
  )
}
