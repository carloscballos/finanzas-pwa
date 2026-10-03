import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Button } from './ui/Button'
import { Form, FormField, FormError } from './ui/Form'
import { SegmentedControl } from './ui/SegmentedControl'
import { tomorrowDateInput } from '../lib/dates'
import { sanitizeDecimalInput } from '../lib/money'
import { useAuth } from '../context/AuthContext'
import * as api from '../lib/api'
import {
  ApiError,
  type Account,
  type Category,
  type RecurrenceFrequency,
  type RecurringTransaction,
  type TransactionType,
} from '../lib/api'

/** Formulario de nuevo ingreso/gasto fijo (plantilla recurrente); se muestra en un Modal. */
export function RecurringForm({ onCreated }: { onCreated: (item: RecurringTransaction) => void }) {
  const { token } = useAuth()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loaded, setLoaded] = useState(false)
  const [accountId, setAccountId] = useState('')
  const [type, setType] = useState<TransactionType>('EXPENSE')
  const [categoryId, setCategoryId] = useState('')
  const [amount, setAmount] = useState('')
  const [frequency, setFrequency] = useState<RecurrenceFrequency>('MONTHLY')
  const [note, setNote] = useState('')
  const [autoApply, setAutoApply] = useState(false)
  const [startDate, setStartDate] = useState(tomorrowDateInput())
  const [creating, setCreating] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    Promise.all([api.getAccounts(token), api.getCategories(token)])
      .then(([a, c]) => {
        setAccounts(a.filter((acc) => acc.type !== 'CREDIT_CARD'))
        setCategories(c)
        setLoaded(true)
      })
      .catch((err) => setFormError(err instanceof ApiError ? err.message : 'No se pudieron cargar cuentas y categorías'))
  }, [token])

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
        autoApply: autoApply || undefined,
        startDate: autoApply ? startDate : undefined,
      })
      onCreated(item)
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'No se pudo crear el pago fijo')
    } finally {
      setCreating(false)
    }
  }

  return (
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
        {loaded && categoriesForType.length === 0 && (
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
          onChange={(e) => setAmount(sanitizeDecimalInput(e.target.value))}
          required
        />
      </FormField>
      <FormField label="Cada cuánto" htmlFor="rt-frequency">
        <select id="rt-frequency" value={frequency} onChange={(e) => setFrequency(e.target.value as RecurrenceFrequency)}>
          <option value="MONTHLY">Cada mes</option>
          <option value="SEMIMONTHLY">Quincenal (días 15 y último)</option>
          <option value="WEEKLY">Cada semana</option>
          <option value="YEARLY">Cada año</option>
        </select>
      </FormField>
      <FormField label="Nota (opcional)" htmlFor="rt-note" full>
        <input id="rt-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Arriendo, salario…" />
      </FormField>
      <label className="ui-field-full" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <input type="checkbox" checked={autoApply} onChange={(e) => setAutoApply(e.target.checked)} />
        Registrarlo automáticamente en cada fecha
      </label>
      {autoApply && (
        <FormField label="Primera vez" htmlFor="rt-start" full>
          <input
            id="rt-start"
            type="date"
            min={tomorrowDateInput()}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
          <span style={{ fontSize: '0.8rem' }}>
            Desde ahí se repite según «Cada cuánto» y se registra solo a las 6 a. m. Si es un gasto y no hay saldo, no se
            crea y te avisamos.
          </span>
        </FormField>
      )}
      <Button type="submit" disabled={creating}>
        {creating ? 'Creando…' : 'Crear pago fijo'}
      </Button>
    </Form>
  )
}
