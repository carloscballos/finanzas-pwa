import { useState, type FormEvent } from 'react'
import { Button } from './ui/Button'
import { Form, FormField, FormError } from './ui/Form'
import { useAuth } from '../context/AuthContext'
import * as api from '../lib/api'
import { ApiError, type Account, type AccountType } from '../lib/api'
import { ACCOUNT_TYPE_LABELS } from '../lib/accountTypeLabels'
import { CURRENCIES, DEFAULT_CURRENCY } from '../lib/currencies'
import { sanitizeDecimalInput } from '../lib/money'

// Las tarjetas de crédito tienen su propio formulario (kind="card"); la lista de
// tipos de una cuenta normal no las incluye.
const ACCOUNT_TYPES = (Object.keys(ACCOUNT_TYPE_LABELS) as AccountType[]).filter((t) => t !== 'CREDIT_CARD')

/** Formulario de nueva cuenta, compartido por la página de Cuentas y el Home (ambos lo muestran en un Modal). */
export function AccountForm({
  kind = 'account',
  onCreated,
}: {
  kind?: 'account' | 'card'
  onCreated: (account: Account) => void
}) {
  const { token } = useAuth()
  const [name, setName] = useState('')
  const [type, setType] = useState<AccountType>(kind === 'card' ? 'CREDIT_CARD' : 'SAVINGS')
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY)
  const [initialBalance, setInitialBalance] = useState('0')
  const [creditLimit, setCreditLimit] = useState('')
  const [paymentDueDay, setPaymentDueDay] = useState('')
  const [creating, setCreating] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  async function handleCreate(event: FormEvent) {
    event.preventDefault()
    if (!token) return
    setFormError(null)
    setCreating(true)
    try {
      const account = await api.createAccount(token, {
        name,
        type,
        currency,
        initialBalance: Number(initialBalance) || 0,
        creditLimit: type === 'CREDIT_CARD' && creditLimit ? Number(creditLimit) : undefined,
        paymentDueDay: type === 'CREDIT_CARD' && paymentDueDay ? Number(paymentDueDay) : undefined,
      })
      onCreated(account)
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'No se pudo crear la cuenta')
      setCreating(false)
    }
  }

  return (
    <Form onSubmit={handleCreate}>
      <FormError>{formError}</FormError>
      <FormField label="Nombre" htmlFor="acc-name" full>
        <input
          id="acc-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus
          placeholder={kind === 'card' ? 'Visa Platino' : 'Ahorros Banorte'}
        />
      </FormField>
      {kind === 'account' && (
        <FormField label="Tipo" htmlFor="acc-type">
          <select id="acc-type" value={type} onChange={(e) => setType(e.target.value as AccountType)}>
            {ACCOUNT_TYPES.map((t) => (
              <option key={t} value={t}>
                {ACCOUNT_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </FormField>
      )}
      <FormField label="Moneda" htmlFor="acc-currency">
        <select id="acc-currency" value={currency} onChange={(e) => setCurrency(e.target.value as typeof currency)}>
          {CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code} · {c.label}
            </option>
          ))}
        </select>
      </FormField>
      <FormField
        label={type === 'CREDIT_CARD' ? 'Deuda actual (0 si no debes nada)' : 'Saldo inicial'}
        htmlFor="acc-balance"
      >
        <input
          id="acc-balance"
          type="number"
          step="0.01"
          max={type === 'CREDIT_CARD' ? 0 : undefined}
          value={initialBalance}
          onChange={(e) => setInitialBalance(sanitizeDecimalInput(e.target.value, 2, true))}
        />
        {type === 'CREDIT_CARD' && (
          <span style={{ fontSize: '0.8rem' }}>
            Va en 0 o negativo — ej. -700000 si ya debes $700.000 en esta tarjeta. No es el cupo disponible.
          </span>
        )}
      </FormField>
      {type === 'CREDIT_CARD' && (
        <>
          <FormField label="Cupo de crédito" htmlFor="acc-credit-limit">
            <input
              id="acc-credit-limit"
              type="number"
              step="0.01"
              min="0"
              value={creditLimit}
              onChange={(e) => setCreditLimit(sanitizeDecimalInput(e.target.value))}
            />
          </FormField>
          <FormField label="Día de pago" htmlFor="acc-due-day">
            <input
              id="acc-due-day"
              type="number"
              min="1"
              max="31"
              value={paymentDueDay}
              onChange={(e) => setPaymentDueDay(sanitizeDecimalInput(e.target.value, 0))}
              placeholder="1-31"
            />
          </FormField>
        </>
      )}
      <Button type="submit" disabled={creating}>
        {creating ? 'Creando…' : kind === 'card' ? 'Crear tarjeta' : 'Crear cuenta'}
      </Button>
    </Form>
  )
}
