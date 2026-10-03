import { useEffect, useState, type FormEvent } from 'react'
import { Trash2 } from 'lucide-react'
import { Layout } from '../components/Layout'
import { AutoScheduleForm } from '../components/AutoScheduleForm'
import { RecurringForm } from '../components/RecurringForm'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { Form, FormField, FormError } from '../components/ui/Form'
import { IconChip } from '../components/ui/IconChip'
import { ListRow } from '../components/ui/ListRow'
import { Modal } from '../components/ui/Modal'
import { Money } from '../components/ui/Money'
import { SectionHeader } from '../components/ui/SectionHeader'
import { SummaryCard, SummaryGrid } from '../components/ui/SummaryCard'
import { useCreateFormToggle } from '../components/ui/useCreateFormToggle'
import { useAuth } from '../context/AuthContext'
import * as api from '../lib/api'
import {
  ApiError,
  type BudgetSuggestion,
  type ForecastSummary,
  type RecurrenceFrequency,
  type RecurringTransaction,
} from '../lib/api'
import { dateTimeInputToIso, formatCalendarDate, formatDateOnly, nowDateTimeInput } from '../lib/dates'
import { formatMoneyMaybeHidden, sanitizeDecimalInput } from '../lib/money'
import { usePrivacy } from '../context/PrivacyContext'
import './ForecastPage.css'

const FREQUENCY_LABELS: Record<RecurrenceFrequency, string> = {
  WEEKLY: 'Cada semana',
  SEMIMONTHLY: 'Quincenal',
  MONTHLY: 'Cada mes',
  YEARLY: 'Cada año',
}

// Mismo criterio que el backend (ForecastService.toMonthlyEquivalent).
function monthlyEquivalent(amount: number, frequency: RecurrenceFrequency): number {
  if (frequency === 'WEEKLY') return (amount * 52) / 12
  if (frequency === 'SEMIMONTHLY') return amount * 2
  if (frequency === 'YEARLY') return amount / 12
  return amount
}

function ApplyForm({ item, onDone }: { item: RecurringTransaction; onDone: () => void }) {
  const { token } = useAuth()
  const [amount, setAmount] = useState(String(item.amount))
  const [note, setNote] = useState(item.note ?? '')
  const [date, setDate] = useState(nowDateTimeInput())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!token) return
    setSaving(true)
    setError(null)
    try {
      await api.applyRecurringTransaction(token, item.id, {
        amount: Number(amount),
        note: note || undefined,
        occurredAt: dateTimeInputToIso(date),
      })
      onDone()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar el movimiento')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Form onSubmit={submit}>
      <FormError>{error}</FormError>
      <FormField label={`Monto (${item.account.currency})`} htmlFor="apply-amount">
        <input
          id="apply-amount"
          type="number"
          step="0.01"
          min="0.01"
          value={amount}
          onChange={(e) => setAmount(sanitizeDecimalInput(e.target.value))}
          required
        />
      </FormField>
      <FormField label="Fecha y hora" htmlFor="apply-date">
        <input id="apply-date" type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} required />
      </FormField>
      <FormField label="Nota (opcional)" htmlFor="apply-note" full>
        <input id="apply-note" value={note} onChange={(e) => setNote(e.target.value)} />
      </FormField>
      <Button type="submit" disabled={saving}>
        {saving ? 'Guardando…' : 'Registrar movimiento'}
      </Button>
    </Form>
  )
}

export function ForecastPage() {
  const { token } = useAuth()
  const { hideValues } = usePrivacy()
  const [summary, setSummary] = useState<ForecastSummary[]>([])
  const [suggestions, setSuggestions] = useState<BudgetSuggestion[]>([])
  const [recurring, setRecurring] = useState<RecurringTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creatingBudgetFor, setCreatingBudgetFor] = useState<string | null>(null)
  const [applying, setApplying] = useState<RecurringTransaction | null>(null)
  const [scheduling, setScheduling] = useState<RecurringTransaction | null>(null)

  const { open: showForm, toggle: toggleForm, close: closeForm } = useCreateFormToggle()

  function loadAll() {
    if (!token) return
    Promise.all([api.getForecastSummary(token), api.getBudgetSuggestions(token), api.getRecurringTransactions(token)])
      .then(([s, sug, r]) => {
        setSummary(s)
        setSuggestions(sug)
        setRecurring(r)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Error al cargar la proyección'))
      .finally(() => setLoading(false))
  }

  useEffect(loadAll, [token])

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

  async function disableAuto(item: RecurringTransaction) {
    if (!token) return
    try {
      const updated = await api.updateRecurringTransaction(token, item.id, { autoApply: false })
      setRecurring((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'No se pudo actualizar')
    }
  }

  async function handleDelete(item: RecurringTransaction) {
    if (!token) return
    if (!confirm(`¿Eliminar "${item.category.name}"? No borra los movimientos que ya registraste con él.`)) return
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
      setSuggestions(await api.getBudgetSuggestions(token))
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'No se pudo crear el presupuesto')
    } finally {
      setCreatingBudgetFor(null)
    }
  }

  // Ingresos primero, y dentro de cada grupo los incluidos antes que los excluidos.
  const sortedRecurring = [...recurring].sort(
    (a, b) => Number(b.active) - Number(a.active) || (a.type === b.type ? 0 : a.type === 'INCOME' ? -1 : 1),
  )

  return (
    <Layout>
      <SectionHeader
        as="h1"
        title="Proyección"
        subtitle="Cuánto te queda en un mes típico: tus ingresos y gastos fijos, más las cuotas de tus tarjetas y préstamos."
      >
        <Button className="toolbar-create-btn" onClick={toggleForm}>
          + Nuevo pago fijo
        </Button>
      </SectionHeader>

      <Modal open={showForm} onClose={closeForm} title="Nuevo ingreso o gasto fijo">
        <RecurringForm
          onCreated={(item) => {
            setRecurring((prev) => [item, ...prev])
            closeForm()
            if (token) api.getForecastSummary(token).then(setSummary).catch(() => {})
          }}
        />
      </Modal>

      <Modal
        open={scheduling !== null}
        onClose={() => setScheduling(null)}
        title={`Registro automático: ${scheduling?.category.name ?? ''}`}
      >
        {scheduling && (
          <AutoScheduleForm
            item={scheduling}
            onDone={(updated) => {
              setRecurring((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
              setScheduling(null)
            }}
          />
        )}
      </Modal>

      <Modal open={applying !== null} onClose={() => setApplying(null)} title={`Registrar: ${applying?.category.name ?? ''}`}>
        {applying && (
          <ApplyForm
            item={applying}
            onDone={() => {
              setApplying(null)
              if (token) api.getRecurringTransactions(token).then(setRecurring).catch(() => {})
            }}
          />
        )}
      </Modal>

      {loading && <p>Cargando…</p>}
      {error && <div className="auth-error">{error}</div>}

      {!loading && !error && (
        <>
          {summary.length === 0 ? (
            <EmptyState>
              Agrega tus ingresos y gastos fijos (salario, arriendo, suscripciones…) para ver cuánto te queda cada mes.
            </EmptyState>
          ) : (
            <SummaryGrid label="Resumen mensual proyectado">
              {summary.map((s) => {
                const spentPercent = s.projectedMonthlyIncome > 0 ? (s.projectedMonthlyExpense / s.projectedMonthlyIncome) * 100 : 100
                return (
                  <SummaryCard
                    key={s.currency}
                    label={`${s.currency} · Te queda en un mes típico`}
                    main={
                      <>
                        <Money amount={s.projectedMonthlyNet} currency={s.currency} tone="flow" size="lg" />
                        <span>
                          {s.projectedMonthlyNet < 0 ? 'te falta al mes' : 'al mes'}
                        </span>
                      </>
                    }
                    progress={{
                      value: Math.min(spentPercent, 100),
                      tone: spentPercent >= 100 ? 'error' : spentPercent >= 80 ? 'warn' : 'ok',
                    }}
                    footLeft={
                      <>
                        Entra <Money amount={s.projectedMonthlyIncome} currency={s.currency} tone="positive" />
                      </>
                    }
                    footRight={
                      <>
                        Sale <Money amount={s.projectedMonthlyExpense} currency={s.currency} tone="negative" />
                        {(s.projectedMonthlyCardInstallments > 0 || s.projectedMonthlyLoanInstallments > 0) && (
                          <span className="forecast-foot-note">
                            (incluye
                            {s.projectedMonthlyLoanInstallments > 0 && (
                              <>
                                {' '}
                                <Money amount={s.projectedMonthlyLoanInstallments} currency={s.currency} /> en préstamos
                              </>
                            )}
                            {s.projectedMonthlyLoanInstallments > 0 && s.projectedMonthlyCardInstallments > 0 && ' y'}
                            {s.projectedMonthlyCardInstallments > 0 && (
                              <>
                                {' '}
                                <Money amount={s.projectedMonthlyCardInstallments} currency={s.currency} /> en cuotas de tarjeta
                              </>
                            )}
                            )
                          </span>
                        )}
                      </>
                    }
                  />
                )
              })}
            </SummaryGrid>
          )}

          <section className="forecast-section">
            <SectionHeader title="Ingresos y gastos fijos" />
            <p className="forecast-hint">
              Puedes registrar cada pago a mano con «Registrar», o activar «Automatizar» para que el sistema lo registre solo en
              su fecha (a las 6 a. m.). Mientras estén incluidas cuentan en la proyección de arriba.
            </p>
            {recurring.length === 0 ? (
              <EmptyState>Todavía no tienes ingresos ni gastos fijos. Crea el primero con «+ Nuevo pago fijo».</EmptyState>
            ) : (
              <div className="forecast-list">
                {sortedRecurring.map((item) => {
                  const monthly = monthlyEquivalent(item.amount, item.frequency)
                  return (
                    <ListRow
                      key={item.id}
                      leading={
                        item.category.emoji && (
                          <IconChip tone={item.type === 'INCOME' ? 'ok' : 'error'}>{item.category.emoji}</IconChip>
                        )
                      }
                      title={
                        <>
                          {item.category.name} {!item.active && <Badge>Fuera de la proyección</Badge>}{' '}
                          {item.autoApply && item.nextRunOn && (
                            <Badge tone="ok">Automático · {formatCalendarDate(item.nextRunOn)}</Badge>
                          )}
                        </>
                      }
                      subtitle={
                        <>
                          {item.account.name} · {FREQUENCY_LABELS[item.frequency]}
                          {item.frequency !== 'MONTHLY' && (
                            <>
                              {' '}
                              (≈ {formatMoneyMaybeHidden(monthly, item.account.currency, hideValues)}/mes)
                            </>
                          )}
                          {' · '}
                          {item.lastAppliedAt ? `Último: ${formatDateOnly(item.lastAppliedAt)}` : 'Aún sin registrar'}
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
                        <div className="forecast-row-actions">
                          <Button variant="secondary" onClick={() => setApplying(item)}>
                            Registrar
                          </Button>
                          {item.autoApply ? (
                            <Button variant="secondary" onClick={() => disableAuto(item)}>
                              Quitar automático
                            </Button>
                          ) : (
                            <Button variant="secondary" onClick={() => setScheduling(item)}>
                              Automatizar
                            </Button>
                          )}
                          <label className="forecast-include">
                            <input type="checkbox" checked={item.active} onChange={() => toggleActive(item)} />
                            Incluir
                          </label>
                          <button
                            type="button"
                            className="icon-danger-btn"
                            title="Eliminar"
                            aria-label={`Eliminar ${item.category.name}`}
                            onClick={() => handleDelete(item)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      }
                      muted={!item.active}
                    />
                  )
                })}
              </div>
            )}
          </section>

          <section className="forecast-section">
            <SectionHeader title="Presupuestos que podrías crear" />
            <p className="forecast-hint">
              {suggestions.length === 0
                ? 'Se calculan con tu gasto real de los últimos meses completos (hasta 3).'
                : suggestions[0].monthsOfHistory === 1
                  ? 'Según lo que gastaste el último mes completo; con más meses de historial el promedio se afina.'
                  : `Según tu gasto promedio de los últimos ${suggestions[0].monthsOfHistory} meses completos.`}
            </p>
            {suggestions.length === 0 ? (
              <EmptyState>Todavía no hay suficiente historial de gastos para sugerir presupuestos.</EmptyState>
            ) : (
              <div className="forecast-list">
                {suggestions.map((s) => {
                  const key = `${s.category.id}:${s.currency}`
                  return (
                    <ListRow
                      key={key}
                      leading={s.category.emoji && <IconChip tone="error">{s.category.emoji}</IconChip>}
                      title={s.category.name}
                      subtitle={<>Gastas ≈ {formatMoneyMaybeHidden(s.averageMonthlySpend, s.currency, hideValues)} al mes</>}
                      trailing={
                        s.existingBudget ? (
                          <Badge tone="ok">
                            Ya tienes uno de {formatMoneyMaybeHidden(s.existingBudget.limitAmount, s.currency, hideValues)}
                          </Badge>
                        ) : (
                          <Button disabled={creatingBudgetFor === key} onClick={() => handleCreateSuggestedBudget(s)}>
                            Crear de {formatMoneyMaybeHidden(Math.ceil(s.averageMonthlySpend), s.currency, hideValues)}
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
