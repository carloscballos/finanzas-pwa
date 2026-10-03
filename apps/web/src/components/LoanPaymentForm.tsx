import { useState, type FormEvent } from 'react'
import { Button } from './ui/Button'
import { Form, FormField, FormError } from './ui/Form'
import { useAuth } from '../context/AuthContext'
import { usePrivacy } from '../context/PrivacyContext'
import * as api from '../lib/api'
import { ApiError, type Account, type Loan } from '../lib/api'
import { dateTimeInputToIso, nowDateTimeInput } from '../lib/dates'
import { formatMoneyMaybeHidden, sanitizeDecimalInput } from '../lib/money'

/**
 * Pagar una cuota de un préstamo: sale dinero real de la cuenta elegida. Solo el
 * capital baja el saldo del préstamo; el reparto (capital / interés / seguro)
 * se calcula solo, o se fija con los datos del extracto del banco.
 */
export function LoanPaymentForm({
  loan,
  accounts,
  onDone,
}: {
  loan: Loan
  accounts: Account[]
  onDone: (updated: Loan) => void
}) {
  const { token } = useAuth()
  const { hideValues } = usePrivacy()
  const candidates = accounts.filter((a) => a.currency === loan.currency)
  const next = loan.nextInstallment
  const fmt = (value: number) => formatMoneyMaybeHidden(value, loan.currency, hideValues)

  const [accountId, setAccountId] = useState(
    candidates.some((a) => a.id === loan.account?.id) ? (loan.account?.id ?? '') : '',
  )
  const [amount, setAmount] = useState('')
  const [principalAmount, setPrincipalAmount] = useState('')
  const [date, setDate] = useState(nowDateTimeInput())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!token || !accountId) return
    setError(null)
    setBusy(true)
    try {
      const updated = await api.payLoanInstallment(token, loan.id, {
        accountId,
        amount: amount ? Number(amount) : undefined,
        principalAmount: principalAmount ? Number(principalAmount) : undefined,
        occurredAt: dateTimeInputToIso(date),
      })
      onDone(updated)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo registrar el pago')
      setBusy(false)
    }
  }

  if (candidates.length === 0) {
    return <p style={{ margin: 0 }}>No tienes cuentas en {loan.currency} — crea una para poder pagar cuotas.</p>
  }

  return (
    <Form onSubmit={handleSubmit}>
      <FormError>{error}</FormError>
      {next && (
        <p className="ui-field-full loan-next" style={{ margin: 0 }}>
          Próxima cuota ≈ <strong>{fmt(next.total)}</strong>: capital {fmt(next.principal)}
          {next.interest > 0 && ` + interés ${fmt(next.interest)}`}
          {next.insurance > 0 && ` + seguro ${fmt(next.insurance)}`}
        </p>
      )}
      <FormField label="Pagas desde la cuenta" htmlFor="loan-pay-account" full>
        <select id="loan-pay-account" value={accountId} onChange={(e) => setAccountId(e.target.value)} required>
          <option value="" disabled>
            Elige una cuenta
          </option>
          {candidates.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} · {fmt(a.currentBalance)}
            </option>
          ))}
        </select>
      </FormField>
      <FormField label={`Total pagado (${loan.currency})`} htmlFor="loan-pay-amount" full>
        <input
          id="loan-pay-amount"
          type="number"
          step="0.01"
          min="0.01"
          placeholder={next ? `Vacío = la próxima cuota (≈ ${fmt(next.total)})` : 'Total pagado'}
          value={amount}
          onChange={(e) => setAmount(sanitizeDecimalInput(e.target.value))}
        />
        <span className="loan-field-hint">Lo que salió de la cuenta.</span>
      </FormField>
      <FormField label="Abono a capital (opcional)" htmlFor="loan-pay-principal" full>
        <input
          id="loan-pay-principal"
          type="number"
          step="0.01"
          min="0"
          placeholder={next ? `Vacío = ≈ ${fmt(next.principal)}` : 'Opcional'}
          value={principalAmount}
          onChange={(e) => setPrincipalAmount(sanitizeDecimalInput(e.target.value))}
        />
        <span className="loan-field-hint">
          Según el extracto. Vacío = total − interés del período − seguro. Para un abono extraordinario a capital, escríbelo aquí.
        </span>
      </FormField>
      <FormField label="Fecha y hora" htmlFor="loan-pay-date" full>
        <input id="loan-pay-date" type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} required />
      </FormField>
      <Button type="submit" disabled={busy || !accountId}>
        {busy ? 'Guardando…' : 'Pagar cuota'}
      </Button>
    </Form>
  )
}
