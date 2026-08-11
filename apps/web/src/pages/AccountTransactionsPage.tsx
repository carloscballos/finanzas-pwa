import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { AccountMembers } from '../components/AccountMembers'
import { useAuth } from '../context/AuthContext'
import * as api from '../lib/api'
import {
  ApiError,
  type Account,
  type Category,
  type RecurrenceFrequency,
  type Transaction,
  type TransactionType,
} from '../lib/api'
import { formatMoney } from '../lib/money'
import './AccountTransactionsPage.css'

function formatDate(iso: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  )
}

// Multiplicador fromCurrency -> toCurrency a partir de la tasa USD/COP,
// solo para previsualizar en el formulario — el backend recalcula/valida la
// tasa real al crear la transferencia.
function previewMultiplier(fromCurrency: string, toCurrency: string, usdToCop: number): number | null {
  if (fromCurrency === toCurrency) return 1
  if (fromCurrency === 'USD' && toCurrency === 'COP') return usdToCop
  if (fromCurrency === 'COP' && toCurrency === 'USD') return 1 / usdToCop
  return null
}

export function AccountTransactionsPage() {
  const { accountId } = useParams<{ accountId: string }>()
  const { token } = useAuth()

  const [account, setAccount] = useState<Account | null>(null)
  const [allAccounts, setAllAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [type, setType] = useState<TransactionType>('EXPENSE')
  const [categoryId, setCategoryId] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [saveAsTemplate, setSaveAsTemplate] = useState(false)
  const [templateFrequency, setTemplateFrequency] = useState<RecurrenceFrequency>('MONTHLY')
  const [creating, setCreating] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [showTransferForm, setShowTransferForm] = useState(false)
  const [toAccountId, setToAccountId] = useState('')
  const [transferAmount, setTransferAmount] = useState('')
  const [transferNote, setTransferNote] = useState('')
  const [transferDate, setTransferDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [autoRate, setAutoRate] = useState<api.ExchangeRate | null>(null)
  const [transferRate, setTransferRate] = useState('')
  const [transferring, setTransferring] = useState(false)
  const [transferError, setTransferError] = useState<string | null>(null)

  useEffect(() => {
    if (!token || !accountId) return
    Promise.all([
      api.getAccount(token, accountId),
      api.getAccounts(token),
      api.getCategories(token),
      api.getTransactions(token, { accountId }),
    ])
      .then(([acc, accs, cats, txs]) => {
        setAccount(acc)
        setAllAccounts(accs)
        setCategories(cats)
        setTransactions(txs)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Error al cargar la cuenta'))
      .finally(() => setLoading(false))
  }, [token, accountId])

  const toAccount = allAccounts.find((a) => a.id === toAccountId) ?? null
  const needsRate = !!(account && toAccount && account.currency !== toAccount.currency)

  useEffect(() => {
    if (!token || !needsRate) {
      setAutoRate(null)
      return
    }
    api
      .getExchangeRateUsdCop(token)
      .then(setAutoRate)
      .catch(() => setAutoRate(null))
  }, [token, needsRate])

  useEffect(() => {
    if (!needsRate || !autoRate || !account || !toAccount) return
    const multiplier = previewMultiplier(account.currency, toAccount.currency, autoRate.rate)
    if (multiplier !== null) setTransferRate(String(Math.round(multiplier * 1e6) / 1e6))
  }, [autoRate, needsRate])

  const previewRate = needsRate ? Number(transferRate) || null : 1
  const previewToAmount =
    transferAmount && previewRate ? Number(transferAmount) * previewRate : null

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
      if (saveAsTemplate) {
        try {
          await api.createRecurringTransaction(token, {
            accountId,
            categoryId,
            type,
            amount: Number(amount),
            note: note || undefined,
            frequency: templateFrequency,
          })
        } catch (err) {
          alert(
            err instanceof ApiError
              ? `El movimiento se registró, pero no se pudo guardar como plantilla: ${err.message}`
              : 'El movimiento se registró, pero no se pudo guardar como plantilla recurrente',
          )
        }
      }
      setAmount('')
      setNote('')
      setCategoryId('')
      setSaveAsTemplate(false)
      setShowForm(false)
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'No se pudo registrar el movimiento')
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(tx: Transaction) {
    if (!token || !accountId) return
    const message = tx.transferId
      ? '¿Eliminar esta transferencia? Se eliminan los dos movimientos asociados.'
      : '¿Eliminar este movimiento?'
    if (!confirm(message)) return
    try {
      if (tx.transferId) {
        await api.deleteTransfer(token, tx.transferId)
      } else {
        await api.deleteTransaction(token, tx.id)
      }
      const [updatedAccount, updatedTxs] = await Promise.all([
        api.getAccount(token, accountId),
        api.getTransactions(token, { accountId }),
      ])
      setAccount(updatedAccount)
      setTransactions(updatedTxs)
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'No se pudo eliminar')
    }
  }

  async function handleTransfer(event: FormEvent) {
    event.preventDefault()
    if (!token || !accountId || !toAccountId) return
    setTransferError(null)
    setTransferring(true)
    try {
      await api.createTransfer(token, {
        fromAccountId: accountId,
        toAccountId,
        fromAmount: Number(transferAmount),
        exchangeRate: needsRate && transferRate ? Number(transferRate) : undefined,
        note: transferNote || undefined,
        occurredAt: new Date(transferDate).toISOString(),
      })
      const [updatedAccount, updatedTxs] = await Promise.all([
        api.getAccount(token, accountId),
        api.getTransactions(token, { accountId }),
      ])
      setAccount(updatedAccount)
      setTransactions(updatedTxs)
      setToAccountId('')
      setTransferAmount('')
      setTransferNote('')
      setTransferRate('')
      setShowTransferForm(false)
    } catch (err) {
      setTransferError(err instanceof ApiError ? err.message : 'No se pudo hacer la transferencia')
    } finally {
      setTransferring(false)
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
            <div className="tx-header-actions">
              <button className="btn btn-secondary" onClick={() => setShowTransferForm((v) => !v)}>
                {showTransferForm ? 'Cancelar' : 'Transferir'}
              </button>
              <button className="btn" onClick={() => setShowForm((v) => !v)}>
                {showForm ? 'Cancelar' : '+ Nuevo movimiento'}
              </button>
            </div>
          </div>

          <AccountMembers account={account} onAccountChange={setAccount} />

          {showTransferForm && (
            <form className="create-form" onSubmit={handleTransfer}>
              {transferError && (
                <div className="auth-error field-full" style={{ margin: 0 }}>
                  {transferError}
                </div>
              )}
              <div className="field">
                <label htmlFor="transfer-to">Cuenta destino</label>
                <select
                  id="transfer-to"
                  value={toAccountId}
                  onChange={(e) => {
                    setToAccountId(e.target.value)
                    setTransferRate('')
                  }}
                  required
                >
                  <option value="" disabled>
                    Elige una
                  </option>
                  {allAccounts
                    .filter((a) => a.id !== accountId)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.currency})
                      </option>
                    ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="transfer-amount">Monto ({account.currency})</label>
                <input
                  id="transfer-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="transfer-date">Fecha</label>
                <input
                  id="transfer-date"
                  type="date"
                  value={transferDate}
                  onChange={(e) => setTransferDate(e.target.value)}
                  required
                />
              </div>
              {needsRate && (
                <div className="field">
                  <label htmlFor="transfer-rate">
                    Tasa ({account.currency} → {toAccount?.currency})
                  </label>
                  <input
                    id="transfer-rate"
                    type="number"
                    step="0.000001"
                    min="0.000001"
                    value={transferRate}
                    onChange={(e) => setTransferRate(e.target.value)}
                    placeholder={autoRate ? undefined : 'Sin tasa automática — ingrésala'}
                    required
                  />
                </div>
              )}
              {toAccount && previewToAmount !== null && (
                <div className="field-full transfer-preview">
                  Recibe en {toAccount.name}: <strong>{formatMoney(previewToAmount, toAccount.currency)}</strong>
                  {needsRate && autoRate && (
                    <span className="tx-row-meta"> · TRM oficial del {autoRate.date.slice(0, 10)}</span>
                  )}
                </div>
              )}
              <div className="field field-full">
                <label htmlFor="transfer-note">Nota (opcional)</label>
                <input
                  id="transfer-note"
                  value={transferNote}
                  onChange={(e) => setTransferNote(e.target.value)}
                />
              </div>
              <button className="btn" type="submit" disabled={transferring}>
                {transferring ? 'Transfiriendo…' : 'Transferir'}
              </button>
            </form>
          )}

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
              <div className="field field-full tx-template-toggle">
                <label>
                  <input
                    type="checkbox"
                    checked={saveAsTemplate}
                    onChange={(e) => setSaveAsTemplate(e.target.checked)}
                  />
                  Guardar como plantilla recurrente
                </label>
                {saveAsTemplate && (
                  <select
                    aria-label="Frecuencia de la plantilla"
                    value={templateFrequency}
                    onChange={(e) => setTemplateFrequency(e.target.value as RecurrenceFrequency)}
                  >
                    <option value="MONTHLY">Mensual</option>
                    <option value="SEMIMONTHLY">Quincenal</option>
                    <option value="WEEKLY">Semanal</option>
                    <option value="YEARLY">Anual</option>
                  </select>
                )}
              </div>
              <button className="btn" type="submit" disabled={creating}>
                {creating ? 'Guardando…' : 'Registrar movimiento'}
              </button>
            </form>
          )}

          {transactions.length === 0 && <p className="tx-empty">Todavía no hay movimientos.</p>}

          <div className="tx-list">
            {transactions.map((tx) => {
              const isTransfer = !!tx.transferId
              return (
                <div className="tx-row" key={tx.id}>
                  {isTransfer ? (
                    <span className="tx-row-emoji">⇄</span>
                  ) : (
                    tx.category?.emoji && <span className="tx-row-emoji">{tx.category.emoji}</span>
                  )}
                  <div className="tx-row-main">
                    <div className="tx-row-category">
                      {isTransfer
                        ? `Transferencia ${tx.type === 'EXPENSE' ? 'hacia' : 'desde'} ${tx.transferCounterpartyAccount?.name ?? ''}`
                        : tx.category?.name}
                    </div>
                    {tx.note && <div className="tx-row-note">{tx.note}</div>}
                    {account.memberCount > 1 && (
                      <div className="tx-row-creator">{tx.createdBy.name}</div>
                    )}
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
              )
            })}
          </div>
        </>
      )}
    </Layout>
  )
}
