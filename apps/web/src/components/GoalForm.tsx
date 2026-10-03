import { useState, type FormEvent } from 'react'
import { Button } from './ui/Button'
import { Form, FormField, FormError } from './ui/Form'
import { CURRENCIES, DEFAULT_CURRENCY } from '../lib/currencies'
import { dateInputToIso } from '../lib/dates'
import { sanitizeDecimalInput } from '../lib/money'
import { useAuth } from '../context/AuthContext'
import * as api from '../lib/api'
import { ApiError, type Goal } from '../lib/api'

/** Formulario de nuevo registro, compartido por su página y el Home (ambos lo muestran en un Modal). */
export function GoalForm({ onCreated }: { onCreated: (goal: Goal) => void }) {
  const { token } = useAuth()
  const [name, setName] = useState('')
  const [targetAmount, setTargetAmount] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY)
  const [creating, setCreating] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  async function handleCreate(event: FormEvent) {
    event.preventDefault()
    if (!token) return
    setFormError(null)
    setCreating(true)
    try {
      const goal = await api.createGoal(token, {
        name,
        targetAmount: Number(targetAmount),
        targetDate: targetDate ? dateInputToIso(targetDate) : undefined,
        currency,
      })
      onCreated(goal)
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'No se pudo crear la meta')
    } finally {
      setCreating(false)
    }
  }

  return (
    <Form onSubmit={handleCreate}>
      <FormError>{formError}</FormError>
      <FormField label="Nombre" htmlFor="goal-name" full>
        <input
          id="goal-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="Enganche del carro"
        />
      </FormField>
      <FormField label="Monto meta" htmlFor="goal-target">
        <input
          id="goal-target"
          type="number"
          step="0.01"
          min="0.01"
          value={targetAmount}
          onChange={(e) => setTargetAmount(sanitizeDecimalInput(e.target.value))}
          required
        />
      </FormField>
      <FormField label="Fecha meta (opcional)" htmlFor="goal-date">
        <input id="goal-date" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
      </FormField>
      <FormField label="Moneda" htmlFor="goal-currency">
        <select id="goal-currency" value={currency} onChange={(e) => setCurrency(e.target.value as typeof currency)}>
          {CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code} · {c.label}
            </option>
          ))}
        </select>
        <span style={{ fontSize: '0.8rem' }}>
          Se ahorra con cuentas en esta moneda. No se puede cambiar después.
        </span>
      </FormField>
      <Button type="submit" disabled={creating}>
        {creating ? 'Creando…' : 'Crear meta'}
      </Button>
    </Form>
  )
}
