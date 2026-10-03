import { useState, type FormEvent } from 'react'
import { Button } from './ui/Button'
import { Form, FormField, FormError } from './ui/Form'
import { CURRENCIES, DEFAULT_CURRENCY } from '../lib/currencies'
import { sanitizeDecimalInput } from '../lib/money'
import { useAuth } from '../context/AuthContext'
import * as api from '../lib/api'
import { ApiError, type Budget, type BudgetPeriod, type Category } from '../lib/api'

/** Formulario de nuevo registro, compartido por su página y el Home (ambos lo muestran en un Modal). */
export function BudgetForm({ categories, onCreated }: { categories: Category[]; onCreated: (budget: Budget) => void }) {
  const { token } = useAuth()
  const [categoryId, setCategoryId] = useState('')
  const [limitAmount, setLimitAmount] = useState('')
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY)
  const [period, setPeriod] = useState<BudgetPeriod>('MONTHLY')
  const [creating, setCreating] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const expenseCategories = categories.filter((c) => c.type === 'EXPENSE')

  async function handleCreate(event: FormEvent) {
    event.preventDefault()
    if (!token) return
    if (!categoryId) {
      setFormError('Elige una categoría de gasto')
      return
    }
    setFormError(null)
    setCreating(true)
    try {
      const budget = await api.createBudget(token, {
        categoryId,
        limitAmount: Number(limitAmount),
        currency,
        period,
      })
      onCreated(budget)
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'No se pudo crear el presupuesto')
    } finally {
      setCreating(false)
    }
  }

  return (
    <Form onSubmit={handleCreate}>
      <FormError>{formError}</FormError>
      <FormField label="Categoría de gasto" htmlFor="budget-category">
        <select id="budget-category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
          <option value="" disabled>
            Elige una
          </option>
          {expenseCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.emoji ? `${c.emoji} ` : ''}
              {c.name}
            </option>
          ))}
        </select>
      </FormField>
      <FormField label="Periodo" htmlFor="budget-period">
        <select id="budget-period" value={period} onChange={(e) => setPeriod(e.target.value as BudgetPeriod)}>
          <option value="MONTHLY">Mensual</option>
          <option value="WEEKLY">Semanal</option>
        </select>
      </FormField>
      <FormField label="Límite" htmlFor="budget-limit">
        <input
          id="budget-limit"
          type="number"
          step="0.01"
          min="0.01"
          value={limitAmount}
          onChange={(e) => setLimitAmount(sanitizeDecimalInput(e.target.value))}
          required
        />
      </FormField>
      <FormField label="Moneda" htmlFor="budget-currency">
        <select id="budget-currency" value={currency} onChange={(e) => setCurrency(e.target.value as typeof currency)}>
          {CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code} · {c.label}
            </option>
          ))}
        </select>
      </FormField>
      <Button type="submit" disabled={creating}>
        {creating ? 'Creando…' : 'Crear presupuesto'}
      </Button>
    </Form>
  )
}
