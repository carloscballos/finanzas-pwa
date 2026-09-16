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
import { ProgressBar } from '../components/ui/ProgressBar'
import { SectionHeader } from '../components/ui/SectionHeader'
import { SegmentedControl } from '../components/ui/SegmentedControl'
import { useCreateFormToggle } from '../components/ui/useCreateFormToggle'
import { useAuth } from '../context/AuthContext'
import * as api from '../lib/api'
import { ApiError, type Account, type Debt, type DebtDirection, type DebtPayment } from '../lib/api'
import { CURRENCIES, DEFAULT_CURRENCY } from '../lib/currencies'
import { formatDateOnly } from '../lib/dates'
import { formatMoneyMaybeHidden, sanitizeDecimalInput } from '../lib/money'
import { usePrivacy } from '../context/PrivacyContext'
import './LoansPage.css'
import './DebtsPage.css'

function formatShortDate(iso: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(iso))
}

function statusBadge(debt: Debt): { label: string; tone: BadgeTone } {
  if (debt.status === 'SETTLED') return { label: 'Liquidada', tone: 'ok' }
  return { label: 'Pendiente', tone: 'neutral' }
}

function paymentBadge(payment: DebtPayment): { label: string; tone: BadgeTone } {
  if (payment.status === 'CONFIRMED') return { label: 'Confirmado', tone: 'ok' }
  if (payment.status === 'REJECTED') return { label: 'Rechazado', tone: 'error' }
  return { label: 'Esperando confirmación', tone: 'warn' }
}

function DebtCard({
  debt,
  payingAccounts,
  onChange,
  onDeleted,
}: {
  debt: Debt
  payingAccounts: Account[]
  onChange: (d: Debt) => void
  onDeleted: (id: string) => void
}) {
  const { token } = useAuth()
  const { hideValues } = usePrivacy()
  const [busy, setBusy] = useState(false)
  const badge = statusBadge(debt)
  const owed = debt.direction === 'THEY_OWE_ME'
  const matchingAccounts = payingAccounts.filter((a) => a.currency === debt.currency)

  const [accountId, setAccountId] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [note, setNote] = useState('')

  async function handleDelete() {
    if (!token) return
    if (!confirm('¿Eliminar esta deuda pendiente? También se eliminan sus abonos registrados.')) return
    try {
      await api.deleteDebt(token, debt.id)
      onDeleted(debt.id)
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'No se pudo eliminar la deuda')
    }
  }

  async function handleRegisterPayment(event: FormEvent) {
    event.preventDefault()
    if (!token || !accountId) return
    setBusy(true)
    try {
      const updated = await api.registerDebtPayment(token, debt.id, {
        accountId,
        amount: amount ? Number(amount) : undefined,
        occurredAt: new Date(date).toISOString(),
        note: note || undefined,
      })
      onChange(updated)
      setAccountId('')
      setAmount('')
      setNote('')
      setDate(new Date().toISOString().slice(0, 10))
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'No se pudo registrar el abono')
    } finally {
      setBusy(false)
    }
  }

  async function handleConfirmPayment(paymentId: string) {
    if (!token) return
    setBusy(true)
    try {
      const updated = await api.confirmDebtPayment(token, debt.id, paymentId)
      onChange(updated)
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'No se pudo confirmar el abono')
    } finally {
      setBusy(false)
    }
  }

  async function handleRejectPayment(paymentId: string) {
    if (!token) return
    setBusy(true)
    try {
      const updated = await api.rejectDebtPayment(token, debt.id, paymentId)
      onChange(updated)
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'No se pudo rechazar el abono')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <div className="loan-card-header">
        <div>
          <div className="debt-party">
            {owed ? `${debt.counterparty.name} te debe` : `Le debes a ${debt.counterparty.name}`}
            {!debt.counterparty.isRegistered && (
              <span className="debt-unregistered" title="Esta persona no tiene cuenta en la app — sus abonos se confirman solos">
                sin cuenta
              </span>
            )}
          </div>
          {debt.description && <div className="debt-description">{debt.description}</div>}
        </div>
        <Money amount={debt.remainingBalance} currency={debt.currency} tone={owed ? 'positive' : 'negative'} size="lg" />
      </div>

      <ProgressBar value={debt.percentPaid} tone="accent" />
      <div className="loan-amounts">
        <span>
          Original <Money amount={debt.amount} currency={debt.currency} />
        </span>
        <span>{debt.percentPaid}% abonado</span>
      </div>

      <div className="debt-actions">
        <Badge tone={badge.tone}>{badge.label}</Badge>
        {debt.status === 'PENDING' && debt.createdByMe && (
          <button className="link-danger" onClick={handleDelete}>
            Eliminar
          </button>
        )}
        {debt.status === 'SETTLED' && debt.settledAt && (
          <span className="debt-settled">
            Liquidada el {formatDateOnly(debt.settledAt)}
          </span>
        )}
      </div>

      {debt.status === 'PENDING' &&
        (matchingAccounts.length === 0 ? (
          <p className="loan-no-account">No tienes ninguna cuenta en {debt.currency} para registrar el abono.</p>
        ) : (
          <form className="loan-pay" onSubmit={handleRegisterPayment}>
            <select aria-label="Tu cuenta" value={accountId} onChange={(e) => setAccountId(e.target.value)} required>
              <option value="" disabled>
                Tu cuenta
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
              min="0.01"
              placeholder={`Monto (saldo pendiente: ${formatMoneyMaybeHidden(debt.remainingBalance, debt.currency, hideValues)})`}
              value={amount}
              onChange={(e) => setAmount(sanitizeDecimalInput(e.target.value))}
            />
            <input type="date" aria-label="Fecha del abono" value={date} onChange={(e) => setDate(e.target.value)} required />
            <input
              aria-label="Nota (opcional)"
              placeholder="Nota (opcional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <Button type="submit" disabled={busy}>
              Registrar abono
            </Button>
          </form>
        ))}

      {debt.payments.length > 0 && (
        <div className="debt-payments">
          {debt.payments.map((payment) => {
            const pBadge = paymentBadge(payment)
            const resolved = payment.status !== 'PENDING_CONFIRMATION'
            return (
              <div key={payment.id} className={`debt-payment-row${resolved ? ' is-resolved' : ''}`}>
                <div className="debt-payment-info">
                  <span>
                    <Money amount={payment.amount} currency={debt.currency} /> · {formatShortDate(payment.occurredAt)}
                  </span>
                  {payment.note && <span className="debt-payment-note">{payment.note}</span>}
                </div>
                <div className="debt-payment-row-actions">
                  {payment.status === 'PENDING_CONFIRMATION' && !payment.createdByMe ? (
                    <>
                      <Button disabled={busy} onClick={() => handleConfirmPayment(payment.id)}>
                        Confirmar
                      </Button>
                      <Button variant="secondary" disabled={busy} onClick={() => handleRejectPayment(payment.id)}>
                        Rechazar
                      </Button>
                    </>
                  ) : payment.status === 'PENDING_CONFIRMATION' ? (
                    <span className="debt-waiting">Esperando confirmación de {debt.counterparty.name}</span>
                  ) : (
                    <Badge tone={pBadge.tone}>{pBadge.label}</Badge>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

export function DebtsPage() {
  const { token } = useAuth()
  const [debts, setDebts] = useState<Debt[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { open: showForm, toggle: toggleForm, close: closeForm } = useCreateFormToggle()
  const [counterpartyName, setCounterpartyName] = useState('')
  const [counterpartyEmail, setCounterpartyEmail] = useState('')
  const [direction, setDirection] = useState<DebtDirection>('THEY_OWE_ME')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY)
  const [description, setDescription] = useState('')
  const [creating, setCreating] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    Promise.all([api.getDebts(token), api.getAccounts(token)])
      .then(([d, a]) => {
        setDebts(d)
        setAccounts(a)
      })
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
        counterpartyName,
        counterpartyEmail: counterpartyEmail || undefined,
        direction,
        amount: Number(amount),
        currency,
        description: description || undefined,
      })
      setDebts((prev) => [debt, ...prev])
      setCounterpartyName('')
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
            <FormField label="Nombre de la otra persona" htmlFor="debt-name">
              <input
                id="debt-name"
                value={counterpartyName}
                onChange={(e) => setCounterpartyName(e.target.value)}
                placeholder="Beto Ruiz"
                required
              />
            </FormField>
            <FormField label="Email (opcional)" htmlFor="debt-email">
              <UserAutocomplete
                id="debt-email"
                value={counterpartyEmail}
                onChange={setCounterpartyEmail}
                onSelect={(result) => setCounterpartyName(result.name)}
                placeholder="alguien@example.com"
                required={false}
              />
              <span style={{ fontSize: '0.8rem' }}>
                Si tiene cuenta en la app, la deuda queda vinculada a ella (sus abonos piden su confirmación). Si no,
                la deuda igual se crea con el nombre como referencia.
              </span>
            </FormField>
            <FormField label="Monto" htmlFor="debt-amount">
              <input
                id="debt-amount"
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(sanitizeDecimalInput(e.target.value))}
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
          <DebtCard key={debt.id} debt={debt} payingAccounts={accounts} onChange={updateOne} onDeleted={removeOne} />
        ))}
      </div>
    </Layout>
  )
}
