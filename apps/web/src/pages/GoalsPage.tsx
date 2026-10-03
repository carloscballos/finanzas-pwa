import { useEffect, useState, type FormEvent } from 'react'
import { Pencil, Target, Trash2 } from 'lucide-react'
import { GoalContributionForm } from '../components/GoalContributionForm'
import { GoalForm } from '../components/GoalForm'
import { Layout } from '../components/Layout'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { Form, FormError, FormField } from '../components/ui/Form'
import { Modal } from '../components/ui/Modal'
import { Money } from '../components/ui/Money'
import { ProgressBar } from '../components/ui/ProgressBar'
import { SectionHeader } from '../components/ui/SectionHeader'
import { SummaryCard, SummaryGrid } from '../components/ui/SummaryCard'
import { useCreateFormToggle } from '../components/ui/useCreateFormToggle'
import { useAuth } from '../context/AuthContext'
import * as api from '../lib/api'
import { ApiError, type Account, type Goal } from '../lib/api'
import { dateInputToIso, formatDateOnly, isoToDateInput } from '../lib/dates'
import { onDataChanged } from '../lib/dataEvents'
import { sanitizeDecimalInput } from '../lib/money'
import './GoalsPage.css'

const DAY_MS = 86_400_000

// Para llegar a tiempo: lo que falta repartido en los meses que quedan (al
// menos uno). Solo tiene sentido con fecha futura y algo por ahorrar.
function monthlyPaceToTarget(goal: Goal): number | null {
  if (!goal.targetDate) return null
  const remaining = goal.targetAmount - goal.currentAmount
  if (remaining <= 0) return null
  const daysLeft = (new Date(goal.targetDate).getTime() - Date.now()) / DAY_MS
  if (daysLeft <= 0) return null
  return remaining / Math.max(1, Math.ceil(daysLeft / 30))
}

interface GoalGroupSummary {
  currency: string
  count: number
  completed: number
  saved: number
  target: number
}

// Un resumen por moneda: sumar metas en COP con metas en USD no significaría nada.
function summarize(goals: Goal[]): GoalGroupSummary[] {
  const groups = new Map<string, GoalGroupSummary>()
  for (const g of goals) {
    const group = groups.get(g.currency) ?? { currency: g.currency, count: 0, completed: 0, saved: 0, target: 0 }
    group.count += 1
    if (g.percentComplete >= 100) group.completed += 1
    group.saved += g.currentAmount
    group.target += g.targetAmount
    groups.set(g.currency, group)
  }
  return Array.from(groups.values())
}

function GoalRow({
  goal,
  accounts,
  onChange,
  onDeleted,
}: {
  goal: Goal
  accounts: Account[]
  onChange: (g: Goal) => void
  onDeleted: (id: string) => void
}) {
  const { token } = useAuth()
  const [flow, setFlow] = useState<'deposit' | 'withdraw' | null>(null)

  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editTarget, setEditTarget] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  const [showDelete, setShowDelete] = useState(false)
  const [refundAccountId, setRefundAccountId] = useState('')
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const refundCandidates = accounts.filter((a) => a.currency === goal.currency && a.type !== 'CREDIT_CARD')
  const remaining = goal.targetAmount - goal.currentAmount
  const completed = goal.percentComplete >= 100
  const pace = monthlyPaceToTarget(goal)

  function startEdit() {
    setEditName(goal.name)
    setEditTarget(String(goal.targetAmount))
    setEditDate(goal.targetDate ? isoToDateInput(goal.targetDate) : '')
    setEditError(null)
    setEditing(true)
  }

  async function handleSaveEdit(event: FormEvent) {
    event.preventDefault()
    if (!token) return
    setEditSaving(true)
    setEditError(null)
    try {
      const updated = await api.updateGoal(token, goal.id, {
        name: editName,
        targetAmount: Number(editTarget),
        targetDate: editDate ? dateInputToIso(editDate) : undefined,
      })
      onChange(updated)
      setEditing(false)
    } catch (err) {
      setEditError(err instanceof ApiError ? err.message : 'No se pudo guardar la meta')
    } finally {
      setEditSaving(false)
    }
  }

  // Con dinero ahorrado hay que decir a qué cuenta se devuelve (ese dinero ya
  // salió de las cuentas cuando se aportó); sin dinero basta confirmar.
  async function handleDelete() {
    if (goal.currentAmount > 0) {
      setDeleteError(null)
      setShowDelete(true)
      return
    }
    if (!confirm(`¿Eliminar la meta "${goal.name}"?`)) return
    await deleteGoal()
  }

  async function deleteGoal(refundTo?: string) {
    if (!token) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await api.deleteGoal(token, goal.id, refundTo)
      onDeleted(goal.id)
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'No se pudo eliminar la meta'
      if (showDelete) setDeleteError(message)
      else alert(message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Card className="goal-row">
      <div className="goal-card-header">
        <div>
          <h3>
            {goal.name} {completed && <Badge tone="ok">Cumplida</Badge>}
          </h3>
          <span className="goal-meta">
            {goal.targetDate ? `Para el ${formatDateOnly(goal.targetDate)}` : 'Sin fecha límite'}
          </span>
        </div>
        {!editing && (
          <div className="goal-row-actions">
            <button
              type="button"
              className="icon-btn"
              title="Editar meta"
              aria-label={`Editar la meta ${goal.name}`}
              onClick={startEdit}
            >
              <Pencil size={16} />
            </button>
            <button
              type="button"
              className="icon-danger-btn"
              title="Eliminar meta"
              aria-label={`Eliminar la meta ${goal.name}`}
              onClick={handleDelete}
            >
              <Trash2 size={16} />
            </button>
          </div>
        )}
      </div>

      {editing ? (
        <Form onSubmit={handleSaveEdit}>
          <FormError>{editError}</FormError>
          <FormField label="Nombre" htmlFor={`goal-edit-name-${goal.id}`} full>
            <input id={`goal-edit-name-${goal.id}`} value={editName} onChange={(e) => setEditName(e.target.value)} required />
          </FormField>
          <FormField label={`Monto meta (${goal.currency})`} htmlFor={`goal-edit-target-${goal.id}`}>
            <input
              id={`goal-edit-target-${goal.id}`}
              type="number"
              step="0.01"
              min="0.01"
              value={editTarget}
              onChange={(e) => setEditTarget(sanitizeDecimalInput(e.target.value))}
              required
            />
          </FormField>
          <FormField label="Fecha meta (opcional)" htmlFor={`goal-edit-date-${goal.id}`}>
            <input id={`goal-edit-date-${goal.id}`} type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
          </FormField>
          <div className="ui-field-full" style={{ display: 'flex', gap: '0.5rem' }}>
            <Button type="submit" disabled={editSaving}>
              {editSaving ? 'Guardando…' : 'Guardar'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setEditing(false)}>
              Cancelar
            </Button>
          </div>
        </Form>
      ) : (
        <>
          <ProgressBar value={goal.percentComplete} tone={completed ? 'ok' : 'accent'} height={8} />
          <div className="goal-amounts">
            <span>
              <Money amount={goal.currentAmount} currency={goal.currency} /> ahorrado
            </span>
            <span className="goal-percent">{goal.percentComplete}%</span>
          </div>
          <div className="goal-amounts">
            <span>
              Meta <Money amount={goal.targetAmount} currency={goal.currency} />
            </span>
            <span>
              {remaining > 0 ? (
                <>
                  Faltan <Money amount={remaining} currency={goal.currency} />
                </>
              ) : (
                '¡Meta cumplida!'
              )}
            </span>
          </div>
          {pace !== null && (
            <div className="goal-pace">
              Para llegar a tiempo: ≈ <Money amount={pace} currency={goal.currency} /> al mes
            </div>
          )}
          <div className="goal-flow-actions">
            <Button variant="secondary" onClick={() => setFlow('deposit')}>
              Aportar
            </Button>
            {goal.currentAmount > 0 && (
              <Button variant="secondary" onClick={() => setFlow('withdraw')}>
                Retirar
              </Button>
            )}
          </div>
        </>
      )}

      <Modal
        open={flow !== null}
        onClose={() => setFlow(null)}
        title={flow === 'withdraw' ? `Retirar de ${goal.name}` : `Aportar a ${goal.name}`}
      >
        {flow && (
          <GoalContributionForm
            goal={goal}
            mode={flow}
            accounts={accounts}
            onDone={(updated) => {
              onChange(updated)
              setFlow(null)
            }}
          />
        )}
      </Modal>

      <Modal open={showDelete} onClose={() => setShowDelete(false)} title="Eliminar meta">
        <p style={{ marginTop: 0 }}>
          <strong>{goal.name}</strong> tiene <Money amount={goal.currentAmount} currency={goal.currency} /> ahorrados.
          Al eliminarla, ese dinero vuelve a la cuenta que elijas.
        </p>
        {deleteError && <div className="auth-error">{deleteError}</div>}
        <FormField label="Devolver a" htmlFor={`refund-${goal.id}`} full>
          <select id={`refund-${goal.id}`} value={refundAccountId} onChange={(e) => setRefundAccountId(e.target.value)}>
            <option value="" disabled>
              Elige una cuenta
            </option>
            {refundCandidates.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </FormField>
        {refundCandidates.length === 0 && (
          <p className="goal-meta">No tienes cuentas en {goal.currency} para recibir el dinero.</p>
        )}
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
          <Button disabled={!refundAccountId || deleting} onClick={() => deleteGoal(refundAccountId)}>
            {deleting ? 'Eliminando…' : 'Devolver y eliminar'}
          </Button>
          <Button variant="secondary" onClick={() => setShowDelete(false)}>
            Cancelar
          </Button>
        </div>
      </Modal>
    </Card>
  )
}

export function GoalsPage() {
  const { token } = useAuth()
  const [goals, setGoals] = useState<Goal[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { open: showForm, toggle: toggleForm, close: closeForm } = useCreateFormToggle()

  useEffect(() => {
    if (!token) return
    Promise.all([api.getGoals(token), api.getAccounts(token)])
      .then(([g, a]) => {
        setGoals(g)
        setAccounts(a)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Error al cargar metas'))
      .finally(() => setLoading(false))
  }, [token])

  // Un movimiento registrado desde el botón global cambia los saldos que se
  // ofrecen al aportar.
  useEffect(() => {
    if (!token) return
    return onDataChanged(() => {
      api
        .getAccounts(token)
        .then(setAccounts)
        .catch(() => {})
    })
  }, [token])

  function handleCreated(goal: Goal) {
    setGoals((prev) => [...prev, goal])
    closeForm()
  }

  function updateOne(updated: Goal) {
    setGoals((prev) => prev.map((g) => (g.id === updated.id ? updated : g)))
    // Aportar o retirar movió dinero entre cuentas: refrescar sus saldos.
    if (token) api.getAccounts(token).then(setAccounts).catch(() => {})
  }

  function removeOne(id: string) {
    setGoals((prev) => prev.filter((g) => g.id !== id))
    if (token) api.getAccounts(token).then(setAccounts).catch(() => {})
  }

  return (
    <Layout fabActions={[{ label: 'Nueva meta', icon: Target, onClick: toggleForm }]}>
      <SectionHeader
        as="h1"
        title="Metas de ahorro"
        subtitle="Lo que aportas sale de tus cuentas y queda guardado en la meta: ya no cuenta como dinero disponible."
      >
        <Button className="toolbar-create-btn" onClick={toggleForm}>
          + Nueva meta
        </Button>
      </SectionHeader>

      <Modal open={showForm} onClose={closeForm} title="Nueva meta">
        <GoalForm onCreated={handleCreated} />
      </Modal>

      {loading && <p>Cargando…</p>}
      {error && <div className="auth-error">{error}</div>}

      {!loading && !error && goals.length === 0 && <EmptyState>Todavía no tienes metas de ahorro.</EmptyState>}

      {goals.length > 0 && (
        <SummaryGrid label="Resumen de metas">
          {summarize(goals).map((g) => {
            const percent = g.target > 0 ? (g.saved / g.target) * 100 : 0
            const missing = g.target - g.saved
            return (
              <SummaryCard
                key={g.currency}
                label={`${g.currency} · Ahorrado en metas`}
                main={
                  <>
                    <Money amount={g.saved} currency={g.currency} size="lg" />
                    <span>
                      de <Money amount={g.target} currency={g.currency} />
                    </span>
                  </>
                }
                progress={{ value: percent, tone: percent >= 100 ? 'ok' : 'accent' }}
                footLeft={
                  missing > 0 ? (
                    <>
                      Faltan <Money amount={missing} currency={g.currency} />
                    </>
                  ) : (
                    '¡Todas las metas cumplidas!'
                  )
                }
                footRight={
                  <>
                    {g.count} meta{g.count !== 1 ? 's' : ''}
                    {g.completed > 0 && (
                      <Badge tone="ok">
                        {g.completed} cumplida{g.completed !== 1 ? 's' : ''}
                      </Badge>
                    )}
                  </>
                }
              />
            )
          })}
        </SummaryGrid>
      )}

      <div className="goal-list">
        {goals.map((goal) => (
          <GoalRow key={goal.id} goal={goal} accounts={accounts} onChange={updateOne} onDeleted={removeOne} />
        ))}
      </div>
    </Layout>
  )
}
