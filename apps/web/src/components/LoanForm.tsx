import { useState, type FormEvent } from 'react'
import { Button } from './ui/Button'
import { Form, FormField, FormError } from './ui/Form'
import { CURRENCIES, DEFAULT_CURRENCY } from '../lib/currencies'
import {
  estimateFrenchInstallment,
  monthlyRateFromAnnualEffective,
  round2,
  sanitizeDecimalInput,
} from '../lib/money'
import { useAuth } from '../context/AuthContext'
import * as api from '../lib/api'
import { ApiError, type Account, type Loan } from '../lib/api'

/** Formulario de nuevo registro, compartido por su página y el Home (ambos lo muestran en un Modal). */
export function LoanForm({ accounts, onCreated }: { accounts: Account[]; onCreated: (loan: Loan) => void }) {
  const { token } = useAuth()
  const [name, setName] = useState('')
  const [principal, setPrincipal] = useState('')
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY)
  const [interestRate, setInterestRate] = useState('')
  const [installmentsTotal, setInstallmentsTotal] = useState('')
  const [installmentAmount, setInstallmentAmount] = useState('')
  const [insuranceAmount, setInsuranceAmount] = useState('')
  const [dueDay, setDueDay] = useState('')
  const [accountId, setAccountId] = useState('')
  const [installmentsPaid, setInstallmentsPaid] = useState('')
  const [remainingBalance, setRemainingBalance] = useState('')
  const [creating, setCreating] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const canEstimate = Number(principal) > 0 && Number(installmentsTotal) > 0

  // Cuota constante (amortización francesa) + seguro. Es un punto de partida:
  // el banco redondea distinto, el usuario la corrige con la del extracto.
  function estimateInstallment() {
    const fixed = estimateFrenchInstallment(
      Number(principal),
      monthlyRateFromAnnualEffective(Number(interestRate) || 0),
      Number(installmentsTotal),
    )
    setInstallmentAmount(String(round2(fixed + (Number(insuranceAmount) || 0))))
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault()
    if (!token) return
    setFormError(null)
    setCreating(true)
    try {
      const loan = await api.createLoan(token, {
        name,
        principal: Number(principal),
        currency: accountId ? undefined : currency,
        interestRate: interestRate ? Number(interestRate) : undefined,
        installmentsTotal: Number(installmentsTotal),
        installmentAmount: Number(installmentAmount),
        insuranceAmount: insuranceAmount ? Number(insuranceAmount) : undefined,
        dueDay: dueDay ? Number(dueDay) : undefined,
        accountId: accountId || undefined,
        installmentsPaid: installmentsPaid ? Number(installmentsPaid) : undefined,
        remainingBalance: remainingBalance ? Number(remainingBalance) : undefined,
      })
      onCreated(loan)
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'No se pudo crear el préstamo')
    } finally {
      setCreating(false)
    }
  }

  return (
    <Form onSubmit={handleCreate}>
      <FormError>{formError}</FormError>
      <FormField label="Nombre" htmlFor="loan-name" full>
        <input
          id="loan-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="Crédito de consumo BBVA"
        />
      </FormField>
      <FormField label="Monto original (desembolsado)" htmlFor="loan-principal">
        <input
          id="loan-principal"
          type="number"
          step="0.01"
          min="0.01"
          value={principal}
          onChange={(e) => setPrincipal(sanitizeDecimalInput(e.target.value))}
          required
        />
      </FormField>
      <FormField label="Moneda" htmlFor="loan-currency">
        {accountId ? (
          <input id="loan-currency" value={accounts.find((a) => a.id === accountId)?.currency ?? ''} disabled />
        ) : (
          <select id="loan-currency" value={currency} onChange={(e) => setCurrency(e.target.value as typeof currency)}>
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} · {c.label}
              </option>
            ))}
          </select>
        )}
      </FormField>
      <FormField label="Número de cuotas" htmlFor="loan-installments">
        <input
          id="loan-installments"
          type="number"
          min="1"
          step="1"
          value={installmentsTotal}
          onChange={(e) => setInstallmentsTotal(sanitizeDecimalInput(e.target.value, 0))}
          required
        />
      </FormField>
      <FormField label="Tasa efectiva anual % (opcional)" htmlFor="loan-rate">
        <input
          id="loan-rate"
          type="number"
          step="0.01"
          min="0"
          placeholder="24.88"
          value={interestRate}
          onChange={(e) => setInterestRate(sanitizeDecimalInput(e.target.value))}
        />
        <span className="loan-field-hint">
          La E.A. del extracto. Reparte cada cuota en interés y capital — sin tasa, toda la cuota se toma como
          capital.
        </span>
      </FormField>
      <FormField label="Seguro / cargos fijos por cuota (opcional)" htmlFor="loan-insurance">
        <input
          id="loan-insurance"
          type="number"
          step="0.01"
          min="0"
          value={insuranceAmount}
          onChange={(e) => setInsuranceAmount(sanitizeDecimalInput(e.target.value))}
        />
      </FormField>
      <FormField label="Valor total de cada cuota" htmlFor="loan-installment-amount">
        <div className="loan-inline-input">
          <input
            id="loan-installment-amount"
            type="number"
            step="0.01"
            min="0.01"
            value={installmentAmount}
            onChange={(e) => setInstallmentAmount(sanitizeDecimalInput(e.target.value))}
            required
          />
          <Button type="button" variant="secondary" onClick={estimateInstallment} disabled={!canEstimate}>
            Estimar
          </Button>
        </div>
        <span className="loan-field-hint">Como la cobra el banco (capital + interés + seguro).</span>
      </FormField>
      <FormField label="Cuotas ya pagadas (opcional)" htmlFor="loan-installments-paid">
        <input
          id="loan-installments-paid"
          type="number"
          min="0"
          step="1"
          placeholder="0"
          value={installmentsPaid}
          onChange={(e) => setInstallmentsPaid(sanitizeDecimalInput(e.target.value, 0))}
        />
        <span className="loan-field-hint">Úsalo para traer un préstamo que ya venía en curso.</span>
      </FormField>
      <FormField label="Saldo de capital actual (opcional)" htmlFor="loan-remaining">
        <input
          id="loan-remaining"
          type="number"
          step="0.01"
          min="0"
          value={remainingBalance}
          onChange={(e) => setRemainingBalance(sanitizeDecimalInput(e.target.value))}
        />
        <span className="loan-field-hint">
          Cópialo del extracto. Si lo dejas vacío, se calcula con la tasa y las cuotas ya pagadas.
        </span>
      </FormField>
      <FormField label="Día de pago (opcional)" htmlFor="loan-due-day">
        <input
          id="loan-due-day"
          type="number"
          min="1"
          max="31"
          value={dueDay}
          onChange={(e) => setDueDay(sanitizeDecimalInput(e.target.value, 0))}
          placeholder="1-31"
        />
      </FormField>
      <FormField label="Cuenta de pago (opcional)" htmlFor="loan-account">
        <select id="loan-account" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          <option value="">Sin preseleccionar</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.currency})
            </option>
          ))}
        </select>
      </FormField>
      <Button type="submit" disabled={creating}>
        {creating ? 'Creando…' : 'Crear préstamo'}
      </Button>
    </Form>
  )
}
