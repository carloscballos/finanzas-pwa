import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Wallet } from 'lucide-react'
import { Layout } from '../components/Layout'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card, CardHeader } from '../components/ui/Card'
import { CardGrid } from '../components/ui/CardGrid'
import { EmptyState } from '../components/ui/EmptyState'
import { Form, FormField, FormError } from '../components/ui/Form'
import { Money } from '../components/ui/Money'
import { SectionHeader } from '../components/ui/SectionHeader'
import { useCreateFormToggle } from '../components/ui/useCreateFormToggle'
import { useAuth } from '../context/AuthContext'
import * as api from '../lib/api'
import { ApiError, type Account, type AccountType } from '../lib/api'
import { ACCOUNT_TYPE_LABELS } from '../lib/accountTypeLabels'
import { CURRENCIES, DEFAULT_CURRENCY } from '../lib/currencies'
import { computeAvailableCredit, formatMoney } from '../lib/money'
import './AccountsPage.css'

const ACCOUNT_TYPES = Object.keys(ACCOUNT_TYPE_LABELS) as AccountType[]

export function AccountsPage() {
  const { token } = useAuth()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { open: showForm, toggle: toggleForm, close: closeForm } = useCreateFormToggle()
  const [name, setName] = useState('')
  const [type, setType] = useState<AccountType>('SAVINGS')
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY)
  const [initialBalance, setInitialBalance] = useState('0')
  const [creditLimit, setCreditLimit] = useState('')
  const [paymentDueDay, setPaymentDueDay] = useState('')
  const [creating, setCreating] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    api
      .getAccounts(token)
      .then(setAccounts)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Error al cargar cuentas'))
      .finally(() => setLoading(false))
  }, [token])

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
      setAccounts((prev) => [...prev, account])
      setName('')
      setType('SAVINGS')
      setCurrency(DEFAULT_CURRENCY)
      setInitialBalance('0')
      setCreditLimit('')
      setPaymentDueDay('')
      closeForm()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'No se pudo crear la cuenta')
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(account: Account) {
    if (!token) return
    if (!confirm(`¿Eliminar la cuenta "${account.name}"? Esta acción no se puede deshacer.`)) return
    try {
      await api.deleteAccount(token, account.id)
      setAccounts((prev) => prev.filter((a) => a.id !== account.id))
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'No se pudo eliminar la cuenta')
    }
  }

  return (
    <Layout fabActions={[{ label: 'Nueva cuenta', icon: Wallet, onClick: toggleForm }]}>
      <SectionHeader as="h1" title="Mis cuentas">
        <Button className={showForm ? '' : 'toolbar-create-btn'} onClick={toggleForm}>
          {showForm ? 'Cancelar' : '+ Nueva cuenta'}
        </Button>
      </SectionHeader>

      {showForm && (
        <Card className="ui-form-card">
          <Form onSubmit={handleCreate}>
            <FormError>{formError}</FormError>
            <FormField label="Nombre" htmlFor="acc-name" full>
              <input
                id="acc-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Ahorros Banorte"
              />
            </FormField>
            <FormField label="Tipo" htmlFor="acc-type">
              <select id="acc-type" value={type} onChange={(e) => setType(e.target.value as AccountType)}>
                {ACCOUNT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {ACCOUNT_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </FormField>
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
                onChange={(e) => setInitialBalance(e.target.value)}
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
                    onChange={(e) => setCreditLimit(e.target.value)}
                  />
                </FormField>
                <FormField label="Día de pago" htmlFor="acc-due-day">
                  <input
                    id="acc-due-day"
                    type="number"
                    min="1"
                    max="31"
                    value={paymentDueDay}
                    onChange={(e) => setPaymentDueDay(e.target.value)}
                    placeholder="1-31"
                  />
                </FormField>
              </>
            )}
            <Button type="submit" disabled={creating}>
              {creating ? 'Creando…' : 'Crear cuenta'}
            </Button>
          </Form>
        </Card>
      )}

      {loading && <p>Cargando…</p>}
      {error && <div className="auth-error">{error}</div>}

      {!loading && !error && accounts.length === 0 && (
        <EmptyState>Todavía no tienes cuentas. Crea la primera arriba.</EmptyState>
      )}

      <CardGrid>
        {accounts.map((account) => (
          <Card key={account.id} accent>
            <CardHeader title={account.name} />
            <span className="account-type">{ACCOUNT_TYPE_LABELS[account.type]}</span>
            <Money amount={account.currentBalance} currency={account.currency} tone="balance" size="lg" />
            {account.type === 'CREDIT_CARD' && account.creditLimit !== null && (
              <div className="account-credit-info">
                Disponible: {formatMoney(computeAvailableCredit(account.creditLimit, account.currentBalance), account.currency)} de{' '}
                {formatMoney(account.creditLimit, account.currency)}
                {account.paymentDueDay && ` · Paga el día ${account.paymentDueDay}`}
              </div>
            )}
            <div className="account-meta">
              <Badge tone={account.role === 'OWNER' ? 'ok' : 'neutral'}>
                {account.role === 'OWNER' ? 'Propietario' : 'Miembro'}
              </Badge>
              {account.memberCount > 1 && <Badge tone="neutral">Compartida · {account.memberCount}</Badge>}
            </div>
            <div className="account-actions">
              <Link to={`/accounts/${account.id}/transactions`}>Ver movimientos</Link>
              {account.role === 'OWNER' && (
                <button className="link-danger" onClick={() => handleDelete(account)}>
                  Eliminar
                </button>
              )}
            </div>
          </Card>
        ))}
      </CardGrid>
    </Layout>
  )
}
