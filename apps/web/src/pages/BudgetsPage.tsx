import { useEffect, useState, type FormEvent } from 'react'
import { PiggyBank } from 'lucide-react'
import { Layout } from '../components/Layout'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { CardGrid } from '../components/ui/CardGrid'
import { EmptyState } from '../components/ui/EmptyState'
import { Form, FormField, FormError } from '../components/ui/Form'
import { Money } from '../components/ui/Money'
import { ProgressBar, type ProgressTone } from '../components/ui/ProgressBar'
import { SectionHeader } from '../components/ui/SectionHeader'
import { useCreateFormToggle } from '../components/ui/useCreateFormToggle'
import { useAuth } from '../context/AuthContext'
import * as api from '../lib/api'
import { ApiError, type Budget, type BudgetPeriod, type Category } from '../lib/api'
import { CURRENCIES, DEFAULT_CURRENCY } from '../lib/currencies'
import './BudgetsPage.css'

function barTone(percentUsed: number): ProgressTone {
  if (percentUsed >= 100) return 'error'
  if (percentUsed >= 70) return 'warn'
  return 'ok'
}

export function BudgetsPage() {
  const { token } = useAuth()
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { open: showForm, toggle: toggleForm, close: closeForm } = useCreateFormToggle()
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
      closeForm()
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
    <Layout fabActions={[{ label: 'Nuevo presupuesto', icon: PiggyBank, onClick: toggleForm }]}>
      <SectionHeader as="h1" title="Presupuestos">
        <Button className={showForm ? '' : 'toolbar-create-btn'} onClick={toggleForm}>
          {showForm ? 'Cancelar' : '+ Nuevo presupuesto'}
        </Button>
      </SectionHeader>

      {showForm && (
        <Card className="ui-form-card">
          <Form onSubmit={handleCreate}>
            <FormError>{formError}</FormError>
            <FormField label="Categoría de gasto" htmlFor="budget-category">
              <select id="budget-category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
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
            </FormField>
            <FormField label="Periodo" htmlFor="budget-period">
              <select id="budget-period" value={period} onChange={(e) => setPeriod(e.target.value as BudgetPeriod)}>
                <option value="MONTHLY">Mensual</option>
                <option value="WEEKLY">Semanal</option>
              </select>
            </FormField>
            <FormField label="Límite" htmlFor="budget-limit">
              <input
                id="budget-limit"
                type="number"
                step="0.01"
                min="0.01"
                value={limitAmount}
                onChange={(e) => setLimitAmount(e.target.value)}
                required
              />
            </FormField>
            <FormField label="Moneda" htmlFor="budget-currency">
              <select id="budget-currency" value={currency} onChange={(e) => setCurrency(e.target.value as typeof currency)}>
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} · {c.label}
                  </option>
                ))}
              </select>
            </FormField>
            <Button type="submit" disabled={creating}>
              {creating ? 'Creando…' : 'Crear presupuesto'}
            </Button>
          </Form>
        </Card>
      )}

      {loading && <p>Cargando…</p>}
      {error && <div className="auth-error">{error}</div>}

      {!loading && !error && budgets.length === 0 && <EmptyState>Todavía no tienes presupuestos.</EmptyState>}

      <CardGrid>
        {budgets.map((budget) => (
          <Card key={budget.id}>
            <div className="budget-card-header">
              <div>
                <h3>
                  {budget.category.emoji ? `${budget.category.emoji} ` : ''}
                  {budget.category.name}
                </h3>
                <span className="budget-period">{budget.period === 'MONTHLY' ? 'Mensual' : 'Semanal'}</span>
              </div>
              <button className="link-danger" onClick={() => handleDelete(budget)}>
                Eliminar
              </button>
            </div>
            <ProgressBar value={budget.percentUsed} tone={barTone(budget.percentUsed)} height={8} />
            <div className="budget-amounts">
              <span>
                <Money amount={budget.spent} currency={budget.currency} /> gastado
              </span>
              <span className="budget-percent">{budget.percentUsed}%</span>
            </div>
            <div className="budget-amounts">
              <span>
                Límite <Money amount={budget.limitAmount} currency={budget.currency} />
              </span>
              <span>
                {budget.remaining >= 0 ? (
                  <>
                    <Money amount={budget.remaining} currency={budget.currency} /> restante
                  </>
                ) : (
                  'Excedido'
                )}
              </span>
            </div>
          </Card>
        ))}
      </CardGrid>
    </Layout>
  )
}
