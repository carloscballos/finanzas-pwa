import { useState, type FormEvent } from 'react'
import { Button } from './ui/Button'
import { Form, FormField, FormError } from './ui/Form'
import { Money } from './ui/Money'
import { useAuth } from '../context/AuthContext'
import { usePrivacy } from '../context/PrivacyContext'
import * as api from '../lib/api'
import { ApiError, type Account, type Goal } from '../lib/api'
import { dateTimeInputToIso, nowDateTimeInput } from '../lib/dates'
import { formatMoneyMaybeHidden, sanitizeDecimalInput } from '../lib/money'

/**
 * Aportar a una meta (cuenta real → meta) o retirar de ella (meta → cuenta real).
 * Ambos son transferencias: para la cuenta es un gasto al aportar, porque ese
 * dinero ya no está disponible. Solo ofrece cuentas en la moneda de la meta.
 */
export function GoalContributionForm({
  goal,
  mode,
  accounts,
  onDone,
}: {
  goal: Goal
  mode: 'deposit' | 'withdraw'
  accounts: Account[]
  onDone: (updated: Goal) => void
}) {
  const { token } = useAuth()
  const { hideValues } = usePrivacy()
  const candidates = accounts.filter((a) => a.currency === goal.currency && a.type !== 'CREDIT_CARD')
  const remaining = Math.max(0, goal.targetAmount - goal.currentAmount)
  const [accountId, setAccountId] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(nowDateTimeInput())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isDeposit = mode === 'deposit'

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!token) return
    setError(null)
    setBusy(true)
    try {
      const updated = await api.contributeToGoal(token, goal.id, {
        amount: isDeposit ? Number(amount) : -Number(amount),
        accountId,
        occurredAt: dateTimeInputToIso(date),
      })
      onDone(updated)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo registrar el movimiento')
      setBusy(false)
    }
  }

  if (candidates.length === 0) {
    return (
      <p style={{ margin: 0 }}>
        No tienes cuentas en {goal.currency} — crea una para poder {isDeposit ? 'aportar' : 'retirar'}.
      </p>
    )
  }

  return (
    <Form onSubmit={handleSubmit}>
      <FormError>{error}</FormError>
      <FormField label={isDeposit ? 'Sale de la cuenta' : 'Vuelve a la cuenta'} htmlFor="goal-flow-account" full>
        <select id="goal-flow-account" value={accountId} onChange={(e) => setAccountId(e.target.value)} required>
          <option value="" disabled>
            Elige una cuenta
          </option>
          {candidates.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} · {formatMoneyMaybeHidden(a.currentBalance, a.currency, hideValues)}
            </option>
          ))}
        </select>
      </FormField>
      <FormField label={`Monto (${goal.currency})`} htmlFor="goal-flow-amount" full>
        <input
          id="goal-flow-amount"
          type="number"
          step="0.01"
          min="0.01"
          max={isDeposit ? undefined : goal.currentAmount}
          value={amount}
          onChange={(e) => setAmount(sanitizeDecimalInput(e.target.value))}
          required
        />
        <span style={{ fontSize: '0.8rem' }}>
          {isDeposit ? (
            remaining > 0 ? (
              <>
                Faltan <Money amount={remaining} currency={goal.currency} /> para la meta.{' '}
                <button type="button" className="link-neutral" onClick={() => setAmount(String(remaining))}>
                  Usar ese monto
                </button>
              </>
            ) : (
              'La meta ya está cumplida; puedes seguir aportando.'
            )
          ) : (
            <>
              Hay <Money amount={goal.currentAmount} currency={goal.currency} /> en la meta.{' '}
              <button type="button" className="link-neutral" onClick={() => setAmount(String(goal.currentAmount))}>
                Retirar todo
              </button>
            </>
          )}
        </span>
      </FormField>
      <FormField label="Fecha y hora" htmlFor="goal-flow-date" full>
        <input
          id="goal-flow-date"
          type="datetime-local"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
      </FormField>
      <Button type="submit" disabled={busy || !accountId || !amount}>
        {busy ? 'Guardando…' : isDeposit ? 'Aportar' : 'Retirar'}
      </Button>
    </Form>
  )
}
