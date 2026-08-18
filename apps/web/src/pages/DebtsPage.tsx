import { useEffect, useState, type FormEvent } from 'react'
import { HandCoins } from 'lucide-react'
import { Layout } from '../components/Layout'
import { UserAutocomplete } from '../components/UserAutocomplete'
import { Badge, type BadgeTone } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { Form, FormField, FormError } from '../components/ui/Form'
import { Money } from '../components/ui/Money'
import { SectionHeader } from '../components/ui/SectionHeader'
import { SegmentedControl } from '../components/ui/SegmentedControl'
import { useCreateFormToggle } from '../components/ui/useCreateFormToggle'
import { useAuth } from '../context/AuthContext'
import * as api from '../lib/api'
import { ApiError, type Debt, type DebtDirection } from '../lib/api'
import { CURRENCIES, DEFAULT_CURRENCY } from '../lib/currencies'
import './DebtsPage.css'

function statusBadge(debt: Debt): { label: string; tone: BadgeTone } {
  if (debt.status === 'SETTLED') return { label: 'Liquidada', tone: 'ok' }
  if (debt.status === 'PAID_PENDING_CONFIRMATION') return { label: 'Esperando confirmación', tone: 'warn' }
  return { label: 'Pendiente', tone: 'neutral' }
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
    <Card>
      <div className="debt-card-header">
        <div>
          <div className="debt-party">
            {owed ? `${debt.counterparty.name} te debe` : `Le debes a ${debt.counterparty.name}`}
          </div>
          {debt.description && <div className="debt-description">{debt.description}</div>}
        </div>
        <Money amount={debt.amount} currency={debt.currency} tone={owed ? 'positive' : 'negative'} size="lg" />
      </div>

      <div className="debt-actions">
        <Badge tone={badge.tone}>{badge.label}</Badge>

        {debt.status === 'PENDING' && (
          <>
            <Button variant="secondary" disabled={busy} onClick={() => run(api.markDebtPaid)}>
              Marcar como pagada
            </Button>
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
              <Button disabled={busy} onClick={() => run(api.confirmDebt)}>
                Confirmar pago
              </Button>
              <Button variant="secondary" disabled={busy} onClick={() => run(api.rejectDebt)}>
                Rechazar
              </Button>
            </>
          ))}

        {debt.status === 'SETTLED' && debt.settledAt && (
          <span className="debt-settled">
            Liquidada el {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(debt.settledAt))}
          </span>
        )}
      </div>
    </Card>
  )
}

export function DebtsPage() {
  const { token } = useAuth()
  const [debts, setDebts] = useState<Debt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { open: showForm, toggle: toggleForm, close: closeForm } = useCreateFormToggle()
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
      closeForm()
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
    <Layout fabActions={[{ label: 'Nueva deuda', icon: HandCoins, onClick: toggleForm }]}>
      <SectionHeader as="h1" title="Deudas">
        <Button className={showForm ? '' : 'toolbar-create-btn'} onClick={toggleForm}>
          {showForm ? 'Cancelar' : '+ Nueva deuda'}
        </Button>
      </SectionHeader>

      {showForm && (
        <Card className="ui-form-card">
          <Form onSubmit={handleCreate}>
            <FormError>{formError}</FormError>
            <div className="ui-field-full">
              <SegmentedControl<DebtDirection>
                value={direction}
                onChange={setDirection}
                options={[
                  { value: 'THEY_OWE_ME', label: 'Me deben', tone: 'ok' },
                  { value: 'I_OWE_THEM', label: 'Yo debo', tone: 'error' },
                ]}
              />
            </div>
            <FormField label="Email de la otra persona" htmlFor="debt-email" full>
              <UserAutocomplete
                id="debt-email"
                value={counterpartyEmail}
                onChange={setCounterpartyEmail}
                placeholder="alguien@example.com"
              />
            </FormField>
            <FormField label="Monto" htmlFor="debt-amount">
              <input
                id="debt-amount"
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </FormField>
            <FormField label="Moneda" htmlFor="debt-currency">
              <select id="debt-currency" value={currency} onChange={(e) => setCurrency(e.target.value as typeof currency)}>
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} · {c.label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Descripción (opcional)" htmlFor="debt-description" full>
              <input
                id="debt-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Cena del viernes"
              />
            </FormField>
            <Button type="submit" disabled={creating}>
              {creating ? 'Creando…' : 'Crear deuda'}
            </Button>
          </Form>
        </Card>
      )}

      {loading && <p>Cargando…</p>}
      {error && <div className="auth-error">{error}</div>}

      {!loading && !error && debts.length === 0 && <EmptyState>No tienes deudas registradas.</EmptyState>}

      <div className="debts-list">
        {debts.map((debt) => (
          <DebtCard key={debt.id} debt={debt} onChange={updateOne} onDeleted={removeOne} />
        ))}
      </div>
    </Layout>
  )
}
