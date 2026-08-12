import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Wallet } from 'lucide-react'
import { Layout } from '../components/Layout'
import { useAuth } from '../context/AuthContext'
import * as api from '../lib/api'
import { ApiError, type Account, type AccountType } from '../lib/api'
import { ACCOUNT_TYPE_LABELS } from '../lib/accountTypeLabels'
import { CURRENCIES, DEFAULT_CURRENCY } from '../lib/currencies'
import { formatMoney } from '../lib/money'
import './AccountsPage.css'

const ACCOUNT_TYPES = Object.keys(ACCOUNT_TYPE_LABELS) as AccountType[]

export function AccountsPage() {
  const { token } = useAuth()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState<AccountType>('SAVINGS')
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY)
  const [initialBalance, setInitialBalance] = useState('0')
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
      })
      setAccounts((prev) => [...prev, account])
      setName('')
      setType('SAVINGS')
      setCurrency(DEFAULT_CURRENCY)
      setInitialBalance('0')
      setShowForm(false)
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
    <Layout
      fabActions={[{ label: 'Nueva cuenta', icon: Wallet, onClick: () => setShowForm(true) }]}
    >
      <div className="accounts-toolbar">
        <h1>Mis cuentas</h1>
        <button
          className={`btn ${showForm ? '' : 'toolbar-create-btn'}`}
          onClick={() => setShowForm((v) => !v)}
        >
          {showForm ? 'Cancelar' : '+ Nueva cuenta'}
        </button>
      </div>

      {showForm && (
        <form className="create-form" onSubmit={handleCreate}>
          {formError && (
            <div className="auth-error field-full" style={{ margin: 0 }}>
              {formError}
            </div>
          )}
          <div className="field field-full">
            <label htmlFor="acc-name">Nombre</label>
            <input
              id="acc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Ahorros Banorte"
            />
          </div>
          <div className="field">
            <label htmlFor="acc-type">Tipo</label>
            <select id="acc-type" value={type} onChange={(e) => setType(e.target.value as AccountType)}>
              {ACCOUNT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {ACCOUNT_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="acc-currency">Moneda</label>
            <select
              id="acc-currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value as typeof currency)}
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} · {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="acc-balance">Saldo inicial</label>
            <input
              id="acc-balance"
              type="number"
              step="0.01"
              value={initialBalance}
              onChange={(e) => setInitialBalance(e.target.value)}
            />
          </div>
          <button className="btn" type="submit" disabled={creating}>
            {creating ? 'Creando…' : 'Crear cuenta'}
          </button>
        </form>
      )}

      {loading && <p>Cargando…</p>}
      {error && <div className="auth-error">{error}</div>}

      {!loading && !error && accounts.length === 0 && (
        <p className="accounts-empty">Todavía no tienes cuentas. Crea la primera arriba.</p>
      )}

      <div className="accounts-grid">
        {accounts.map((account) => (
          <div className="account-card" key={account.id}>
            <div className="account-card-header">
              <div>
                <h3>{account.name}</h3>
                <span className="account-type">{ACCOUNT_TYPE_LABELS[account.type]}</span>
              </div>
            </div>
            <span className={`account-balance ${account.currentBalance < 0 ? 'negative' : ''}`}>
              {formatMoney(account.currentBalance, account.currency)}
            </span>
            <div className="account-meta">
              <span className={`badge ${account.role === 'OWNER' ? 'badge-ok' : 'badge-neutral'}`}>
                {account.role === 'OWNER' ? 'Propietario' : 'Miembro'}
              </span>
              {account.memberCount > 1 && (
                <span className="badge badge-neutral">Compartida · {account.memberCount}</span>
              )}
            </div>
            <div className="account-actions">
              <Link to={`/accounts/${account.id}/transactions`}>Ver movimientos</Link>
              {account.role === 'OWNER' && (
                <button className="link-danger" onClick={() => handleDelete(account)}>
                  Eliminar
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </Layout>
  )
}
