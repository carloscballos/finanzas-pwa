import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { CardGrid } from '../components/ui/CardGrid'
import { EmptyState } from '../components/ui/EmptyState'
import { Form, FormField, FormError } from '../components/ui/Form'
import { IconChip } from '../components/ui/IconChip'
import { ListRow } from '../components/ui/ListRow'
import { Money } from '../components/ui/Money'
import { SectionHeader } from '../components/ui/SectionHeader'
import { SegmentedControl } from '../components/ui/SegmentedControl'
import { useCreateFormToggle } from '../components/ui/useCreateFormToggle'
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

  const { open: showForm, toggle: toggleForm, close: closeForm } = useCreateFormToggle()
  const [accountId, setAccountId] = useState('')
  const [type, setType] = useState<TransactionType>('EXPENSE')
  const [categoryId, setCategoryId] = useState('')
  const [amount, setAmount] = useState('')
  const [frequency, setFrequency] = useState<RecurrenceFrequency>('MONTHLY')
  const [note, setNote] = useState('')
  const [creating, setCreating] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [applyingId, setApplyingId] = useState<string | null>(null)
  const [applyAmount, setApplyAmount] = useState('')
  const [applyNote, setApplyNote] = useState('')
  const [applyDate, setApplyDate] = useState('')
  const [applying, setApplying] = useState(false)
  const [applyError, setApplyError] = useState<string | null>(null)

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

  function selectType(next: TransactionType) {
    setType(next)
    setCategoryId('')
  }

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
        note: note || undefined,
      })
      setRecurring((prev) => [item, ...prev])
      setAccountId('')
      setCategoryId('')
      setAmount('')
      setNote('')
      closeForm()
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
    if (!confirm(`¿Eliminar la plantilla "${item.category.name}"? No borra los movimientos ya creados a partir de ella.`))
      return
    try {
      await api.deleteRecurringTransaction(token, item.id)
      setRecurring((prev) => prev.filter((r) => r.id !== item.id))
      setSummary(await api.getForecastSummary(token))
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'No se pudo eliminar')
    }
  }

  function openApply(item: RecurringTransaction) {
    setApplyingId(item.id)
    setApplyAmount(String(item.amount))
    setApplyNote(item.note ?? '')
    setApplyDate(new Date().toISOString().slice(0, 10))
    setApplyError(null)
  }

  function closeApply() {
    setApplyingId(null)
  }

  async function submitApply(event: FormEvent, item: RecurringTransaction) {
    event.preventDefault()
    if (!token) return
    setApplying(true)
    setApplyError(null)
    try {
      await api.applyRecurringTransaction(token, item.id, {
        amount: Number(applyAmount),
        note: applyNote || undefined,
        occurredAt: new Date(applyDate).toISOString(),
      })
      setRecurring(await api.getRecurringTransactions(token))
      setApplyingId(null)
    } catch (err) {
      setApplyError(err instanceof ApiError ? err.message : 'No se pudo guardar el movimiento')
    } finally {
      setApplying(false)
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
      <SectionHeader as="h1" title="Proyección">
        <Button onClick={toggleForm}>{showForm ? 'Cancelar' : '+ Nuevo recurrente'}</Button>
      </SectionHeader>

      {loading && <p>Cargando…</p>}
      {error && <div className="auth-error">{error}</div>}

      {showForm && (
        <Card className="ui-form-card">
          <Form onSubmit={handleCreate}>
            <FormError>{formError}</FormError>
            <div className="ui-field-full">
              <SegmentedControl<TransactionType>
                value={type}
                onChange={selectType}
                options={[
                  { value: 'EXPENSE', label: 'Gasto', tone: 'error' },
                  { value: 'INCOME', label: 'Ingreso', tone: 'ok' },
                ]}
              />
            </div>
            <FormField label="Cuenta" htmlFor="rt-account">
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
            </FormField>
            <FormField label="Categoría" htmlFor="rt-category">
              <select id="rt-category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
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
            </FormField>
            <FormField label="Monto" htmlFor="rt-amount">
              <input
                id="rt-amount"
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </FormField>
            <FormField label="Frecuencia" htmlFor="rt-frequency">
              <select id="rt-frequency" value={frequency} onChange={(e) => setFrequency(e.target.value as RecurrenceFrequency)}>
                <option value="MONTHLY">Mensual</option>
                <option value="SEMIMONTHLY">Quincenal</option>
                <option value="WEEKLY">Semanal</option>
                <option value="YEARLY">Anual</option>
              </select>
            </FormField>
            <FormField label="Nota (opcional)" htmlFor="rt-note" full>
              <input id="rt-note" value={note} onChange={(e) => setNote(e.target.value)} />
            </FormField>
            <Button type="submit" disabled={creating}>
              {creating ? 'Creando…' : 'Crear plantilla'}
            </Button>
          </Form>
        </Card>
      )}

      {!loading && !error && (
        <>
          <section className="forecast-section">
            <SectionHeader title="Resumen mensual proyectado" />
            {summary.length === 0 ? (
              <EmptyState>Sin movimientos recurrentes activos todavía — créalos arriba para ver una proyección.</EmptyState>
            ) : (
              <CardGrid minWidth={260}>
                {summary.map((s) => (
                  <Card key={s.currency}>
                    <div className="summary-card-currency">{s.currency}</div>
                    <div className="summary-row">
                      <span>Ingreso recurrente</span>
                      <Money amount={s.projectedMonthlyIncome} currency={s.currency} tone="positive" />
                    </div>
                    <div className="summary-row">
                      <span>Gasto proyectado</span>
                      <Money amount={s.projectedMonthlyExpense} currency={s.currency} tone="negative" />
                    </div>
                    {s.projectedMonthlyCardInstallments > 0 && (
                      <div className="summary-row">
                        <span>· de las cuales, cuotas de tarjeta de crédito</span>
                        <Money amount={s.projectedMonthlyCardInstallments} currency={s.currency} tone="negative" />
                      </div>
                    )}
                    <div className="summary-row net">
                      <span>Neto mensual</span>
                      <Money amount={s.projectedMonthlyNet} currency={s.currency} tone="flow" />
                    </div>
                  </Card>
                ))}
              </CardGrid>
            )}
          </section>

          <section className="forecast-section">
            <SectionHeader title="Movimientos recurrentes" />
            <p className="recurring-row-meta" style={{ marginBottom: '0.75rem' }}>
              Son plantillas: no se generan solas. Ábrelas cuando quieras registrar el movimiento.
            </p>
            {recurring.length === 0 ? (
              <EmptyState>No tienes plantillas de movimientos recurrentes.</EmptyState>
            ) : (
              <div className="recurring-list">
                {recurring.map((item) => (
                  <div key={item.id}>
                    <ListRow
                      leading={
                        item.category.emoji && (
                          <IconChip tone={item.type === 'INCOME' ? 'ok' : 'error'}>{item.category.emoji}</IconChip>
                        )
                      }
                      title={item.category.name}
                      subtitle={
                        <>
                          {item.account.name} · {FREQUENCY_LABELS[item.frequency]}
                          {' · '}
                          {item.lastAppliedAt ? `Última vez: ${formatDate(item.lastAppliedAt)}` : 'Nunca aplicada'}
                          {!item.active && ' · Fuera de la proyección'}
                        </>
                      }
                      trailing={
                        <Money
                          amount={item.amount}
                          currency={item.account.currency}
                          tone={item.type === 'INCOME' ? 'positive' : 'negative'}
                          showSign
                        />
                      }
                      actions={
                        <div className="recurring-row-actions">
                          <Button onClick={() => openApply(item)}>Aplicar</Button>
                          <Button variant="secondary" onClick={() => toggleActive(item)}>
                            {item.active ? 'Quitar de proyección' : 'Incluir en proyección'}
                          </Button>
                          <button className="link-danger" onClick={() => handleDelete(item)}>
                            Eliminar
                          </button>
                        </div>
                      }
                      muted={!item.active}
                    />
                    {applyingId === item.id && (
                      <form className="apply-form" onSubmit={(e) => submitApply(e, item)}>
                        <FormError>{applyError}</FormError>
                        <FormField label="Monto" htmlFor={`apply-amount-${item.id}`}>
                          <input
                            id={`apply-amount-${item.id}`}
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={applyAmount}
                            onChange={(e) => setApplyAmount(e.target.value)}
                            required
                          />
                        </FormField>
                        <FormField label="Fecha" htmlFor={`apply-date-${item.id}`}>
                          <input
                            id={`apply-date-${item.id}`}
                            type="date"
                            value={applyDate}
                            onChange={(e) => setApplyDate(e.target.value)}
                            required
                          />
                        </FormField>
                        <FormField label="Nota (opcional)" htmlFor={`apply-note-${item.id}`} full>
                          <input id={`apply-note-${item.id}`} value={applyNote} onChange={(e) => setApplyNote(e.target.value)} />
                        </FormField>
                        <div className="recurring-row-actions">
                          <Button type="submit" disabled={applying}>
                            {applying ? 'Guardando…' : 'Guardar movimiento'}
                          </Button>
                          <Button variant="secondary" type="button" onClick={closeApply}>
                            Cancelar
                          </Button>
                        </div>
                      </form>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="forecast-section">
            <SectionHeader title="Presupuestos sugeridos" />
            <p className="recurring-row-meta" style={{ marginBottom: '0.75rem' }}>
              Basado en tu gasto real promedio de los últimos 3 meses completos.
            </p>
            {suggestions.length === 0 ? (
              <EmptyState>Todavía no hay suficiente historial de gastos para sugerir presupuestos.</EmptyState>
            ) : (
              <div className="suggestions-list">
                {suggestions.map((s) => {
                  const key = `${s.category.id}:${s.currency}`
                  return (
                    <ListRow
                      key={key}
                      leading={s.category.emoji && <IconChip tone="error">{s.category.emoji}</IconChip>}
                      title={s.category.name}
                      subtitle={
                        <>
                          Promedio: {formatMoney(s.averageMonthlySpend, s.currency)}/mes
                        </>
                      }
                      trailing={
                        s.existingBudget ? (
                          <Badge tone="ok">Ya tienes presupuesto de {formatMoney(s.existingBudget.limitAmount, s.currency)}</Badge>
                        ) : (
                          <Button disabled={creatingBudgetFor === key} onClick={() => handleCreateSuggestedBudget(s)}>
                            Crear presupuesto de {formatMoney(Math.ceil(s.averageMonthlySpend), s.currency)}
                          </Button>
                        )
                      }
                    />
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
