import { useEffect, useState, type FormEvent } from 'react'
import { PiggyBank, Pencil, Trash2 } from 'lucide-react'
import { BudgetForm } from '../components/BudgetForm'
import { Layout } from '../components/Layout'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { Form, FormField, FormError } from '../components/ui/Form'
import { Modal } from '../components/ui/Modal'
import { Money } from '../components/ui/Money'
import { ProgressBar, type ProgressTone } from '../components/ui/ProgressBar'
import { SectionHeader } from '../components/ui/SectionHeader'
import { useCreateFormToggle } from '../components/ui/useCreateFormToggle'
import { useAuth } from '../context/AuthContext'
import * as api from '../lib/api'
import { ApiError, type Budget, type BudgetPeriod, type Category } from '../lib/api'
import { sanitizeDecimalInput } from '../lib/money'
import { onDataChanged } from '../lib/dataEvents'
import './BudgetsPage.css'

function barTone(percentUsed: number): ProgressTone {
  if (percentUsed >= 100) return 'error'
  if (percentUsed >= 70) return 'warn'
  return 'ok'
}

// Los periodos del backend son UTC (mes calendario / semana de lunes a lunes) y
// periodEnd es el INICIO del siguiente periodo, así que se formatea en UTC para
// que "se reinicia el 1 nov" no se corra un día en zonas al oeste de UTC.
function formatResetDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(iso))
}

interface BudgetGroupSummary {
  key: string
  currency: string
  period: BudgetPeriod
  count: number
  limit: number
  spent: number
  exceeded: number
  atRisk: number
}

// Un resumen por moneda y periodo: sumar un presupuesto semanal con uno mensual
// (o COP con USD) no significaría nada.
function summarize(budgets: Budget[]): BudgetGroupSummary[] {
  const groups = new Map<string, BudgetGroupSummary>()
  for (const b of budgets) {
    const key = `${b.currency}-${b.period}`
    const g = groups.get(key) ?? { key, currency: b.currency, period: b.period, count: 0, limit: 0, spent: 0, exceeded: 0, atRisk: 0 }
    g.count += 1
    g.limit += b.limitAmount
    g.spent += b.spent
    if (b.percentUsed >= 100) g.exceeded += 1
    else if (b.percentUsed >= 70) g.atRisk += 1
    groups.set(key, g)
  }
  return Array.from(groups.values())
}

export function BudgetsPage() {
  const { token } = useAuth()
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { open: showForm, toggle: toggleForm, close: closeForm } = useCreateFormToggle()


  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLimitAmount, setEditLimitAmount] = useState('')
  const [editPeriod, setEditPeriod] = useState<BudgetPeriod>('MONTHLY')
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

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

  useEffect(() => {
    if (!token) return
    return onDataChanged(() => {
      api
        .getBudgets(token)
        .then(setBudgets)
        .catch(() => {})
    })
  }, [token])

  function handleCreated(budget: Budget) {
    setBudgets((prev) => [...prev, budget])
    closeForm()
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

  function startEdit(budget: Budget) {
    setEditingId(budget.id)
    setEditLimitAmount(String(budget.limitAmount))
    setEditPeriod(budget.period)
    setEditError(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditError(null)
  }

  async function handleSaveEdit(event: FormEvent, budget: Budget) {
    event.preventDefault()
    if (!token) return
    setEditSaving(true)
    setEditError(null)
    try {
      const updated = await api.updateBudget(token, budget.id, {
        limitAmount: Number(editLimitAmount),
        period: editPeriod,
      })
      setBudgets((prev) => prev.map((b) => (b.id === budget.id ? updated : b)))
      setEditingId(null)
    } catch (err) {
      setEditError(err instanceof ApiError ? err.message : 'No se pudo guardar el presupuesto')
    } finally {
      setEditSaving(false)
    }
  }

  return (
    <Layout fabActions={[{ label: 'Nuevo presupuesto', icon: PiggyBank, onClick: toggleForm }]}>
      <SectionHeader as="h1" title="Presupuestos">
        <Button className="toolbar-create-btn" onClick={toggleForm}>
          + Nuevo presupuesto
        </Button>
      </SectionHeader>

      <Modal open={showForm} onClose={closeForm} title="Nuevo presupuesto">
        <BudgetForm categories={categories} onCreated={handleCreated} />
      </Modal>

      {loading && <p>Cargando…</p>}
      {error && <div className="auth-error">{error}</div>}

      {!loading && !error && budgets.length === 0 && <EmptyState>Todavía no tienes presupuestos.</EmptyState>}

      {budgets.length > 0 && (
        <section className="budget-summary" aria-label="Resumen de presupuestos">
          {summarize(budgets).map((g) => {
            const percent = g.limit > 0 ? (g.spent / g.limit) * 100 : 0
            const remaining = g.limit - g.spent
            return (
              <Card key={g.key} className="budget-summary-card">
                <div className="budget-summary-label">
                  {g.currency} · {g.period === 'MONTHLY' ? 'Mensual' : 'Semanal'}
                </div>
                <div className="budget-summary-main">
                  <Money amount={g.spent} currency={g.currency} size="lg" />
                  <span>
                    gastado de <Money amount={g.limit} currency={g.currency} />
                  </span>
                </div>
                <ProgressBar value={percent} tone={barTone(percent)} height={10} />
                <div className="budget-summary-foot">
                  <span>
                    {remaining >= 0 ? (
                      <>
                        <Money amount={remaining} currency={g.currency} /> disponible
                      </>
                    ) : (
                      <>
                        Excedido por <Money amount={-remaining} currency={g.currency} tone="negative" />
                      </>
                    )}
                  </span>
                  <span className="budget-summary-badges">
                    {g.count} presupuesto{g.count !== 1 ? 's' : ''}
                    {g.exceeded > 0 && <Badge tone="error">{g.exceeded} excedido{g.exceeded !== 1 ? 's' : ''}</Badge>}
                    {g.atRisk > 0 && <Badge tone="warn">{g.atRisk} cerca del límite</Badge>}
                  </span>
                </div>
              </Card>
            )
          })}
        </section>
      )}

      <div className="budget-list">
        {budgets.map((budget) => (
          <Card key={budget.id} className="budget-row">
            <div className="budget-card-header">
              <div>
                <h3>
                  {budget.category.emoji ? `${budget.category.emoji} ` : ''}
                  {budget.category.name}
                </h3>
                <span className="budget-period">
                  {budget.period === 'MONTHLY' ? 'Mensual' : 'Semanal'} · se reinicia el {formatResetDate(budget.periodEnd)}
                </span>
              </div>
              {editingId !== budget.id && (
                <div className="budget-row-actions">
                  <button
                    type="button"
                    className="icon-btn"
                    title="Editar presupuesto"
                    aria-label={`Editar el presupuesto de ${budget.category.name}`}
                    onClick={() => startEdit(budget)}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    className="icon-danger-btn"
                    title="Eliminar presupuesto"
                    aria-label={`Eliminar el presupuesto de ${budget.category.name}`}
                    onClick={() => handleDelete(budget)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>

            {editingId === budget.id ? (
              <Form onSubmit={(e) => handleSaveEdit(e, budget)}>
                <FormError>{editError}</FormError>
                <FormField label="Periodo" htmlFor={`budget-edit-period-${budget.id}`} full>
                  <select
                    id={`budget-edit-period-${budget.id}`}
                    value={editPeriod}
                    onChange={(e) => setEditPeriod(e.target.value as BudgetPeriod)}
                  >
                    <option value="MONTHLY">Mensual</option>
                    <option value="WEEKLY">Semanal</option>
                  </select>
                </FormField>
                <FormField label={`Límite (${budget.currency})`} htmlFor={`budget-edit-limit-${budget.id}`} full>
                  <input
                    id={`budget-edit-limit-${budget.id}`}
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={editLimitAmount}
                    onChange={(e) => setEditLimitAmount(sanitizeDecimalInput(e.target.value))}
                    required
                  />
                </FormField>
                <div className="ui-field-full" style={{ display: 'flex', gap: '0.5rem' }}>
                  <Button type="submit" disabled={editSaving}>
                    {editSaving ? 'Guardando…' : 'Guardar'}
                  </Button>
                  <Button type="button" variant="secondary" onClick={cancelEdit}>
                    Cancelar
                  </Button>
                </div>
              </Form>
            ) : (
              <>
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
              </>
            )}
          </Card>
        ))}
      </div>
    </Layout>
  )
}
