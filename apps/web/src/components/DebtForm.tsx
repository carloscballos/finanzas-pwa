import { useState, type FormEvent } from 'react'
import { Button } from './ui/Button'
import { Form, FormField, FormError } from './ui/Form'
import { UserAutocomplete } from './UserAutocomplete'
import { SegmentedControl } from './ui/SegmentedControl'
import { CURRENCIES, DEFAULT_CURRENCY } from '../lib/currencies'
import { sanitizeDecimalInput } from '../lib/money'
import { useAuth } from '../context/AuthContext'
import * as api from '../lib/api'
import { ApiError, type Debt, type DebtDirection } from '../lib/api'

/** Formulario de nuevo registro, compartido por su página y el Home (ambos lo muestran en un Modal). */
export function DebtForm({ onCreated }: { onCreated: (debt: Debt) => void }) {
  const { token } = useAuth()
  const [counterpartyName, setCounterpartyName] = useState('')
  const [counterpartyEmail, setCounterpartyEmail] = useState('')
  const [direction, setDirection] = useState<DebtDirection>('THEY_OWE_ME')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY)
  const [description, setDescription] = useState('')
  const [creating, setCreating] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

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
      onCreated(debt)
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'No se pudo crear la deuda')
    } finally {
      setCreating(false)
    }
  }

  return (
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
  )
}
