import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { AccountMembers } from '../components/AccountMembers'
import { useAuth } from '../context/AuthContext'
import * as api from '../lib/api'
import { ApiError, type Account, type Category, type Transaction, type TransactionType } from '../lib/api'
import { formatMoney } from '../lib/money'
import './AccountTransactionsPage.css'

function formatDate(iso: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  )
}

export function AccountTransactionsPage() {
  const { accountId } = useParams<{ accountId: string }>()
  const { token } = useAuth()

  const [account, setAccount] = useState<Account | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [type, setType] = useState<TransactionType>('EXPENSE')
  const [categoryId, setCategoryId] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [creating, setCreating] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (!token || !accountId) return
    Promise.all([
      api.getAccount(token, accountId),
      api.getCategories(token),
      api.getTransactions(token, { accountId }),
    ])
      .then(([acc, cats, txs]) => {
        setAccount(acc)
        setCategories(cats)
        setTransactions(txs)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Error al cargar la cuenta'))
      .finally(() => setLoading(false))
  }, [token, accountId])

  const categoriesForType = categories.filter((c) => c.type === type)

  async function handleCreate(event: FormEvent) {
    event.preventDefault()
    if (!token || !accountId) return
    if (!categoryId) {
      setFormError('Elige una categoría')
      return
    }
    setFormError(null)
    setCreating(true)
    try {
      const tx = await api.createTransaction(token, {
        accountId,
        categoryId,
        type,
        amount: Number(amount),
        note: note || undefined,
      })
      setTransactions((prev) => [tx, ...prev])
      const updatedAccount = await api.getAccount(token, accountId)
      setAccount(updatedAccount)
      setAmount('')
      setNote('')
      setCategoryId('')
      setShowForm(false)
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'No se pudo registrar el movimiento')
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(tx: Transaction) {
    if (!token || !accountId) return
    if (!confirm('¿Eliminar este movimiento?')) return
    try {
      await api.deleteTransaction(token, tx.id)
      setTransactions((prev) => prev.filter((t) => t.id !== tx.id))
      const updatedAccount = await api.getAccount(token, accountId)
      setAccount(updatedAccount)
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'No se pudo eliminar el movimiento')
    }
  }

  return (
    <Layout>
      <Link className="tx-back" to="/accounts">
        ← Volver a cuentas
      </Link>

      {loading && <p>Cargando…</p>}
      {error && <div className="auth-error">{error}</div>}

      {!loading && !error && account && (
        <>
          <div className="tx-header">
            <div>
              <h1>{account.name}</h1>
              <span className={`tx-balance ${account.currentBalance < 0 ? 'negative' : ''}`}>
                {formatMoney(account.currentBalance, account.currency)}
              </span>
            </div>
            <button className="btn" onClick={() => setShowForm((v) => !v)}>
              {showForm ? 'Cancelar' : '+ Nuevo movimiento'}
            </button>
          </div>

          <AccountMembers account={account} onAccountChange={setAccount} />

          {showForm && (
            <form className="create-form" onSubmit={handleCreate}>
              {formError && (
                <div className="auth-error field-full" style={{ margin: 0 }}>
                  {formError}
                </div>
              )}
              <div className="tx-type-toggle">
                <button
                  type="button"
                  className={type === 'EXPENSE' ? 'active-expense' : ''}
                  onClick={() => {
                    setType('EXPENSE')
                    setCategoryId('')
                  }}
                >
                  Gasto
                </button>
                <button
                  type="button"
                  className={type === 'INCOME' ? 'active-income' : ''}
                  onClick={() => {
                    setType('INCOME')
                    setCategoryId('')
                  }}
                >
                  Ingreso
                </button>
              </div>
              <div className="field">
                <label htmlFor="tx-category">Categoría</label>
                <select
                  id="tx-category"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  required
                >
                  <option value="" disabled>
                    Elige una
                  </option>
                  {categoriesForType.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.emoji ? `${c.emoji} ` : ''}
                      {c.name}
                    </option>
                  ))}
                </select>
                {categoriesForType.length === 0 && (
                  <span style={{ fontSize: '0.8rem' }}>
                    No tienes categorías de {type === 'EXPENSE' ? 'gasto' : 'ingreso'} — créalas en{' '}
                    <Link to="/categories">Categorías</Link>
                  </span>
                )}
              </div>
              <div className="field">
                <label htmlFor="tx-amount">Monto</label>
                <input
                  id="tx-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>
              <div className="field field-full">
                <label htmlFor="tx-note">Nota (opcional)</label>
                <input id="tx-note" value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
              <button className="btn" type="submit" disabled={creating}>
                {creating ? 'Guardando…' : 'Registrar movimiento'}
              </button>
            </form>
          )}

          {transactions.length === 0 && <p className="tx-empty">Todavía no hay movimientos.</p>}

          <div className="tx-list">
            {transactions.map((tx) => (
              <div className="tx-row" key={tx.id}>
                {tx.category.emoji && <span className="tx-row-emoji">{tx.category.emoji}</span>}
                <div className="tx-row-main">
                  <div className="tx-row-category">{tx.category.name}</div>
                  {tx.note && <div className="tx-row-note">{tx.note}</div>}
                </div>
                <div className="tx-row-date">{formatDate(tx.occurredAt)}</div>
                <span className={`tx-row-amount ${tx.type === 'INCOME' ? 'income' : 'expense'}`}>
                  {tx.type === 'INCOME' ? '+' : '-'}
                  {formatMoney(tx.amount, tx.account.currency)}
                </span>
                <button className="link-danger" onClick={() => handleDelete(tx)}>
                  ✕
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </Layout>
  )
}
