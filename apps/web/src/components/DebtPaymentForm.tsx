import { useState, type FormEvent } from 'react'
import { Button } from './ui/Button'
import { Form, FormField, FormError } from './ui/Form'
import { Money } from './ui/Money'
import { useAuth } from '../context/AuthContext'
import { usePrivacy } from '../context/PrivacyContext'
import * as api from '../lib/api'
import { ApiError, type Account, type Debt } from '../lib/api'
import { dateTimeInputToIso, nowDateTimeInput } from '../lib/dates'
import { formatMoneyMaybeHidden, sanitizeDecimalInput } from '../lib/money'

/**
 * Registrar un abono a una deuda. Mueve dinero real en la cuenta elegida: entra
 * si te deben (INCOME) y sale si debes (EXPENSE). Si la otra persona no tiene
 * cuenta en la app el abono se confirma solo; si la tiene, queda esperando su
 * confirmación. Monto vacío = abonar todo el saldo pendiente.
 */
export function DebtPaymentForm({
  debt,
  accounts,
  onDone,
}: {
  debt: Debt
  accounts: Account[]
  onDone: (updated: Debt) => void
}) {
  const { token } = useAuth()
  const { hideValues } = usePrivacy()
  const owed = debt.direction === 'THEY_OWE_ME'
  const candidates = accounts.filter((a) => a.currency === debt.currency)
  const [accountId, setAccountId] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(nowDateTimeInput())
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!token || !accountId) return
    setError(null)
    setBusy(true)
    try {
      const updated = await api.registerDebtPayment(token, debt.id, {
        accountId,
        amount: amount ? Number(amount) : undefined,
        occurredAt: dateTimeInputToIso(date),
        note: note || undefined,
      })
      onDone(updated)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo registrar el abono')
      setBusy(false)
    }
  }

  if (candidates.length === 0) {
    return <p style={{ margin: 0 }}>No tienes ninguna cuenta en {debt.currency} para registrar el abono.</p>
  }

  return (
    <Form onSubmit={handleSubmit}>
      <FormError>{error}</FormError>
      <FormField label={owed ? 'Lo recibes en la cuenta' : 'Pagas desde la cuenta'} htmlFor="debt-pay-account" full>
        <select id="debt-pay-account" value={accountId} onChange={(e) => setAccountId(e.target.value)} required>
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
      <FormField label={`Monto (${debt.currency})`} htmlFor="debt-pay-amount" full>
        <input
          id="debt-pay-amount"
          type="number"
          step="0.01"
          min="0.01"
          max={debt.remainingBalance}
          placeholder="Vacío = todo el saldo"
          value={amount}
          onChange={(e) => setAmount(sanitizeDecimalInput(e.target.value))}
        />
        <span style={{ fontSize: '0.8rem' }}>
          Saldo pendiente: <Money amount={debt.remainingBalance} currency={debt.currency} />. Si lo dejas vacío se abona todo.
        </span>
      </FormField>
      <FormField label="Fecha y hora" htmlFor="debt-pay-date" full>
        <input id="debt-pay-date" type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} required />
      </FormField>
      <FormField label="Nota (opcional)" htmlFor="debt-pay-note" full>
        <input id="debt-pay-note" value={note} onChange={(e) => setNote(e.target.value)} />
      </FormField>
      <Button type="submit" disabled={busy || !accountId}>
        {busy ? 'Guardando…' : 'Registrar abono'}
      </Button>
    </Form>
  )
}
