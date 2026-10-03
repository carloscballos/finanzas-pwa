import { useEffect, useState, type FormEvent } from 'react'
import { Target } from 'lucide-react'
import { GoalForm } from '../components/GoalForm'
import { Layout } from '../components/Layout'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { CardGrid } from '../components/ui/CardGrid'
import { EmptyState } from '../components/ui/EmptyState'
import { Modal } from '../components/ui/Modal'
import { Money } from '../components/ui/Money'
import { ProgressBar } from '../components/ui/ProgressBar'
import { SectionHeader } from '../components/ui/SectionHeader'
import { useCreateFormToggle } from '../components/ui/useCreateFormToggle'
import { useAuth } from '../context/AuthContext'
import * as api from '../lib/api'
import { ApiError, type Account, type Goal } from '../lib/api'
import { dateTimeInputToIso, formatDateOnly, nowDateTimeInput } from '../lib/dates'
import { sanitizeDecimalInput } from '../lib/money'
import './GoalsPage.css'

function GoalCard({
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
  const [amount, setAmount] = useState('')
  const matchingAccounts = accounts.filter((a) => a.currency === goal.currency)
  const [accountId, setAccountId] = useState('')
  const [date, setDate] = useState(nowDateTimeInput)
  const [busy, setBusy] = useState(false)

  async function handleContribute(event: FormEvent) {
    event.preventDefault()
    if (!token || !amount || !accountId) return
    setBusy(true)
    try {
      const updated = await api.contributeToGoal(token, goal.id, {
        amount: Number(amount),
        accountId,
        occurredAt: dateTimeInputToIso(date),
      })
      onChange(updated)
      setAmount('')
      setDate(nowDateTimeInput())
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'No se pudo registrar el aporte')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!token) return
    if (!confirm(`¿Eliminar la meta "${goal.name}"?`)) return
    try {
      await api.deleteGoal(token, goal.id)
      onDeleted(goal.id)
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'No se pudo eliminar la meta')
    }
  }

  return (
    <Card>
      <div className="goal-card-header">
        <div>
          <h3>{goal.name}</h3>
          {goal.account && <span className="goal-meta">Cuenta: {goal.account.name}</span>}
          {goal.targetDate && (
            <span className="goal-meta">
              {' '}
              · Meta: {formatDateOnly(goal.targetDate)}
            </span>
          )}
        </div>
        <button className="link-danger" onClick={handleDelete}>
          Eliminar
        </button>
      </div>
      <ProgressBar value={goal.percentComplete} tone="accent" />
      <div className="goal-amounts">
        <span>
          <Money amount={goal.currentAmount} currency={goal.currency} /> ahorrado
        </span>
        <span>{goal.percentComplete}%</span>
      </div>
      <div className="goal-amounts">
        <span>
          Meta <Money amount={goal.targetAmount} currency={goal.currency} />
        </span>
      </div>
      {matchingAccounts.length === 0 ? (
        <p className="goal-no-account">
          No tienes cuentas en {goal.currency} — crea una para poder aportar o retirar.
        </p>
      ) : (
        <form className="goal-contribute" onSubmit={handleContribute}>
          <select
            aria-label="Cuenta"
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
            placeholder="Monto (+ aportar, - retirar)"
            value={amount}
            onChange={(e) => setAmount(sanitizeDecimalInput(e.target.value, 2, true))}
          />
          <input type="datetime-local" aria-label="Fecha y hora del aporte" value={date} onChange={(e) => setDate(e.target.value)} required />
          <Button type="submit" disabled={busy || !amount || !accountId}>
            Registrar
          </Button>
        </form>
      )}
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

  function handleCreated(goal: Goal) {
    setGoals((prev) => [...prev, goal])
    closeForm()
  }

  function updateOne(updated: Goal) {
    setGoals((prev) => prev.map((g) => (g.id === updated.id ? updated : g)))
  }

  function removeOne(id: string) {
    setGoals((prev) => prev.filter((g) => g.id !== id))
  }

  return (
    <Layout fabActions={[{ label: 'Nueva meta', icon: Target, onClick: toggleForm }]}>
      <SectionHeader as="h1" title="Metas de ahorro">
        <Button className="toolbar-create-btn" onClick={toggleForm}>
          + Nueva meta
        </Button>
      </SectionHeader>

      <Modal open={showForm} onClose={closeForm} title="Nueva meta">
        <GoalForm accounts={accounts} onCreated={handleCreated} />
      </Modal>

      {loading && <p>Cargando…</p>}
      {error && <div className="auth-error">{error}</div>}

      {!loading && !error && goals.length === 0 && <EmptyState>Todavía no tienes metas de ahorro.</EmptyState>}

      <CardGrid>
        {goals.map((goal) => (
          <GoalCard key={goal.id} goal={goal} accounts={accounts} onChange={updateOne} onDeleted={removeOne} />
        ))}
      </CardGrid>
    </Layout>
  )
}
