import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeftRight, FileUp, Receipt, ShoppingBag } from 'lucide-react'
import { Layout } from '../components/Layout'
import { AccountMembers } from '../components/AccountMembers'
import { useAuth } from '../context/AuthContext'
import * as api from '../lib/api'
import {
  ApiError,
  type Account,
  type CardPurchase,
  type Category,
  type RecurrenceFrequency,
  type StatementPreviewItem,
  type Transaction,
  type TransactionType,
} from '../lib/api'
import { computeAvailableCredit, formatMoney } from '../lib/money'
import './AccountTransactionsPage.css'
import './LoansPage.css'

function StatementPreviewRow({
  item,
  cardAccountId,
  cardCurrency,
  payingAccounts,
  onCreated,
  onCaughtUp,
  onDismiss,
}: {
  item: StatementPreviewItem
  cardAccountId: string
  cardCurrency: string
  payingAccounts: Account[]
  onCreated: (item: StatementPreviewItem) => void
  onCaughtUp: (item: StatementPreviewItem) => void
  onDismiss: (item: StatementPreviewItem) => void
}) {
  const { token } = useAuth()
  const matchingAccounts = payingAccounts.filter((a) => a.currency === cardCurrency)
  const [accountId, setAccountId] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleCreate() {
    if (!token) return
    setBusy(true)
    try {
      await api.createCardPurchase(token, {
        accountId: cardAccountId,
        merchant: item.merchant,
        amount: item.amount,
        installmentsTotal: item.installmentsTotal,
        installmentAmount: item.installmentAmount,
        installmentsPaid: item.suggestedInstallmentsPaid,
      })
      onCreated(item)
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'No se pudo crear la compra')
    } finally {
      setBusy(false)
    }
  }

  async function handleCatchUp() {
    if (!token || !item.purchaseId || !item.cuotasBehind || !accountId) return
    setBusy(true)
    try {
      for (let i = 0; i < item.cuotasBehind; i++) {
        await api.payCardPurchaseInstallment(token, item.purchaseId, { accountId })
      }
      onCaughtUp(item)
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'No se pudo poner al día')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="statement-row">
      <div className="statement-row-main">
        <strong>{item.merchant}</strong>
        <span className="statement-row-meta">
          {formatMoney(item.amount, cardCurrency)} · {item.installmentsTotal} cuota
          {item.installmentsTotal > 1 ? 's' : ''} de {formatMoney(item.installmentAmount, cardCurrency)}
          {item.statementInstallmentCurrent && ` · extracto: cuota ${item.statementInstallmentCurrent}`}
        </span>
      </div>

      {item.matchType === 'NEW' && (
        <button className="btn" disabled={busy} onClick={handleCreate}>
          Crear compra
        </button>
      )}

      {item.matchType === 'UP_TO_DATE' && <span className="badge badge-ok">Ya al día</span>}

      {item.matchType === 'BEHIND' &&
        (matchingAccounts.length === 0 ? (
          <span className="statement-row-meta">Sin cuenta en {cardCurrency} para pagar.</span>
        ) : (
          <div className="statement-row-catchup">
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="" disabled>
                Cuenta
              </option>
              {matchingAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <button className="btn" disabled={busy || !accountId} onClick={handleCatchUp}>
              Ponerme al día ({item.cuotasBehind} cuota{item.cuotasBehind !== 1 ? 's' : ''})
            </button>
          </div>
        ))}

      <button className="link-danger" onClick={() => onDismiss(item)}>
        Ignorar
      </button>
    </div>
  )
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  )
}

function formatShortDate(iso: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(iso))
}

function CardPurchaseCard({
  purchase,
  payingAccounts,
  onChange,
  onDeleted,
}: {
  purchase: CardPurchase
  payingAccounts: Account[]
  onChange: (p: CardPurchase) => void
  onDeleted: (id: string) => void
}) {
  const { token } = useAuth()
  const matchingAccounts = payingAccounts.filter((a) => a.currency === purchase.account.currency)
  const [accountId, setAccountId] = useState('')
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)

  async function handlePay(event: FormEvent) {
    event.preventDefault()
    if (!token || !accountId) return
    setBusy(true)
    try {
      const updated = await api.payCardPurchaseInstallment(token, purchase.id, {
        accountId,
        amount: amount ? Number(amount) : undefined,
      })
      onChange(updated)
      setAmount('')
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'No se pudo registrar el pago')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!token) return
    if (!confirm(`¿Eliminar la compra "${purchase.merchant}"? También se eliminan sus movimientos registrados.`)) return
    try {
      await api.deleteCardPurchase(token, purchase.id)
      onDeleted(purchase.id)
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'No se pudo eliminar la compra')
    }
  }

  return (
    <div className="loan-card">
      <div className="loan-card-header">
        <div>
          <h3>{purchase.merchant}</h3>
          <span className="loan-meta">
            Cuota {purchase.installmentsPaid}/{purchase.installmentsTotal} · {formatShortDate(purchase.purchasedAt)}
          </span>
        </div>
        <button className="link-danger" onClick={handleDelete}>
          Eliminar
        </button>
      </div>
      <div className="loan-bar-track">
        <div className="loan-bar-fill" style={{ width: `${Math.min(purchase.percentPaid, 100)}%` }} />
      </div>
      <div className="loan-amounts">
        <span>{formatMoney(purchase.remainingBalance, purchase.account.currency)} pendiente</span>
        <span>{purchase.percentPaid}% pagado</span>
      </div>
      <div className="loan-amounts">
        <span>Original {formatMoney(purchase.amount, purchase.account.currency)}</span>
        <span className={`badge ${purchase.status === 'PAID_OFF' ? 'badge-ok' : 'badge-neutral'}`}>
          {purchase.status === 'PAID_OFF' ? 'Pagada' : 'Activa'}
        </span>
      </div>

      {purchase.status !== 'PAID_OFF' &&
        (matchingAccounts.length === 0 ? (
          <p className="loan-no-account">No tienes otra cuenta en {purchase.account.currency} para pagar cuotas.</p>
        ) : (
          <form className="loan-pay" onSubmit={handlePay}>
            <select
              aria-label="Cuenta de pago"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              required
            >
              <option value="" disabled>
                Cuenta
              </option>
              {matchingAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <input
              type="number"
              step="0.01"
              min="0.01"
              placeholder={`Monto (cuota ${formatMoney(purchase.installmentAmount, purchase.account.currency)})`}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <button className="btn" type="submit" disabled={busy || !accountId}>
              Pagar cuota
            </button>
          </form>
        ))}
    </div>
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
  const [searchParams] = useSearchParams()

  const [account, setAccount] = useState<Account | null>(null)
  const [allAccounts, setAllAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [cardPurchases, setCardPurchases] = useState<CardPurchase[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [statementPreview, setStatementPreview] = useState<StatementPreviewItem[] | null>(null)
  const [statementLoading, setStatementLoading] = useState(false)
  const [statementError, setStatementError] = useState<string | null>(null)
  const statementInputRef = useRef<HTMLInputElement>(null)

  const [showPurchaseForm, setShowPurchaseForm] = useState(false)
  const [purchaseMerchant, setPurchaseMerchant] = useState('')
  const [purchaseAmount, setPurchaseAmount] = useState('')
  const [purchaseInstallmentsTotal, setPurchaseInstallmentsTotal] = useState('')
  const [purchaseInstallmentAmount, setPurchaseInstallmentAmount] = useState('')
  const [purchaseInstallmentsPaid, setPurchaseInstallmentsPaid] = useState('')
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [creatingPurchase, setCreatingPurchase] = useState(false)
  const [purchaseFormError, setPurchaseFormError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(searchParams.get('new') === '1')
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
        if (acc.type === 'CREDIT_CARD') {
          api
            .getCardPurchases(token, { accountId })
            .then(setCardPurchases)
            .catch(() => setCardPurchases([]))
        }
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Error al cargar la cuenta'))
      .finally(() => setLoading(false))
  }, [token, accountId])

  async function refreshAccountAndPurchases() {
    if (!token || !accountId) return
    const [updatedAccount, updatedPurchases] = await Promise.all([
      api.getAccount(token, accountId),
      api.getCardPurchases(token, { accountId }),
    ])
    setAccount(updatedAccount)
    setCardPurchases(updatedPurchases)
  }

  async function refreshAll() {
    if (!token || !accountId) return
    const [updatedAccount, updatedPurchases, updatedTxs] = await Promise.all([
      api.getAccount(token, accountId),
      api.getCardPurchases(token, { accountId }),
      api.getTransactions(token, { accountId }),
    ])
    setAccount(updatedAccount)
    setCardPurchases(updatedPurchases)
    setTransactions(updatedTxs)
  }

  async function handleStatementFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!token || !accountId || !file) return
    setStatementError(null)
    setStatementLoading(true)
    setStatementPreview(null)
    try {
      const preview = await api.previewCardStatement(token, accountId, file)
      setStatementPreview(preview)
    } catch (err) {
      setStatementError(err instanceof ApiError ? err.message : 'No se pudo leer el extracto')
    } finally {
      setStatementLoading(false)
    }
  }

  function removeStatementItem(item: StatementPreviewItem) {
    setStatementPreview((prev) => (prev ? prev.filter((i) => i !== item) : prev))
  }

  async function handleStatementItemDone(item: StatementPreviewItem) {
    removeStatementItem(item)
    await refreshAll()
  }

  async function handleCreatePurchase(event: FormEvent) {
    event.preventDefault()
    if (!token || !accountId) return
    setPurchaseFormError(null)
    setCreatingPurchase(true)
    try {
      await api.createCardPurchase(token, {
        accountId,
        merchant: purchaseMerchant,
        amount: Number(purchaseAmount),
        installmentsTotal: Number(purchaseInstallmentsTotal),
        installmentAmount: Number(purchaseInstallmentAmount),
        installmentsPaid: purchaseInstallmentsPaid ? Number(purchaseInstallmentsPaid) : undefined,
        purchasedAt: new Date(purchaseDate).toISOString(),
      })
      const updatedTxs = await api.getTransactions(token, { accountId })
      setTransactions(updatedTxs)
      await refreshAccountAndPurchases()
      setPurchaseMerchant('')
      setPurchaseAmount('')
      setPurchaseInstallmentsTotal('')
      setPurchaseInstallmentAmount('')
      setPurchaseInstallmentsPaid('')
      setPurchaseDate(new Date().toISOString().slice(0, 10))
      setShowPurchaseForm(false)
    } catch (err) {
      setPurchaseFormError(err instanceof ApiError ? err.message : 'No se pudo registrar la compra')
    } finally {
      setCreatingPurchase(false)
    }
  }

  function updatePurchase(updated: CardPurchase) {
    setCardPurchases((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
    if (accountId && token) {
      Promise.all([api.getAccount(token, accountId), api.getTransactions(token, { accountId })]).then(
        ([acc, txs]) => {
          setAccount(acc)
          setTransactions(txs)
        },
      )
    }
  }

  function removePurchase(id: string) {
    setCardPurchases((prev) => prev.filter((p) => p.id !== id))
    if (accountId && token) {
      Promise.all([api.getAccount(token, accountId), api.getTransactions(token, { accountId })]).then(
        ([acc, txs]) => {
          setAccount(acc)
          setTransactions(txs)
        },
      )
    }
  }

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
    <Layout
      fabActions={
        account
          ? [
              { label: 'Nuevo movimiento', icon: Receipt, onClick: () => setShowForm(true) },
              { label: 'Transferir', icon: ArrowLeftRight, onClick: () => setShowTransferForm(true) },
              ...(account.type === 'CREDIT_CARD'
                ? [{ label: 'Nueva compra', icon: ShoppingBag, onClick: () => setShowPurchaseForm(true) }]
                : []),
            ]
          : []
      }
    >
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
              {account.type === 'CREDIT_CARD' && account.creditLimit !== null && (
                <div className="account-credit-info">
                  Disponible: {formatMoney(computeAvailableCredit(account.creditLimit, account.currentBalance), account.currency)} de{' '}
                  {formatMoney(account.creditLimit, account.currency)}
                  {account.paymentDueDay && ` · Paga el día ${account.paymentDueDay}`}
                </div>
              )}
            </div>
            <div className="tx-header-actions">
              <button
                className={`btn btn-secondary ${showTransferForm ? '' : 'toolbar-create-btn'}`}
                onClick={() => setShowTransferForm((v) => !v)}
              >
                {showTransferForm ? 'Cancelar' : 'Transferir'}
              </button>
              <button
                className={`btn ${showForm ? '' : 'toolbar-create-btn'}`}
                onClick={() => setShowForm((v) => !v)}
              >
                {showForm ? 'Cancelar' : '+ Nuevo movimiento'}
              </button>
            </div>
          </div>

          <AccountMembers account={account} onAccountChange={setAccount} />

          {account.type === 'CREDIT_CARD' && (
            <section className="purchases-section">
              <div className="tx-header-actions" style={{ justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <h2>Compras a cuotas</h2>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    ref={statementInputRef}
                    type="file"
                    accept="application/pdf"
                    style={{ display: 'none' }}
                    onChange={handleStatementFile}
                  />
                  <button
                    className="btn btn-secondary"
                    disabled={statementLoading}
                    onClick={() => statementInputRef.current?.click()}
                  >
                    {statementLoading ? 'Leyendo…' : <><FileUp size={16} /> Subir extracto</>}
                  </button>
                  <button
                    className={`btn btn-secondary ${showPurchaseForm ? '' : 'toolbar-create-btn'}`}
                    onClick={() => setShowPurchaseForm((v) => !v)}
                  >
                    {showPurchaseForm ? 'Cancelar' : '+ Nueva compra'}
                  </button>
                </div>
              </div>

              {statementError && (
                <div className="auth-error" style={{ marginBottom: '1rem' }}>
                  {statementError}
                </div>
              )}

              {statementPreview && (
                <div className="statement-preview">
                  {statementPreview.length === 0 ? (
                    <p className="tx-empty">Ya procesaste todo lo del extracto.</p>
                  ) : (
                    statementPreview.map((item, i) => (
                      <StatementPreviewRow
                        key={`${item.merchant}-${i}`}
                        item={item}
                        cardAccountId={account.id}
                        cardCurrency={account.currency}
                        payingAccounts={allAccounts.filter((a) => a.id !== account.id)}
                        onCreated={handleStatementItemDone}
                        onCaughtUp={handleStatementItemDone}
                        onDismiss={removeStatementItem}
                      />
                    ))
                  )}
                </div>
              )}

              {showPurchaseForm && (
                <form className="create-form" onSubmit={handleCreatePurchase}>
                  {purchaseFormError && (
                    <div className="auth-error field-full" style={{ margin: 0 }}>
                      {purchaseFormError}
                    </div>
                  )}
                  <div className="field field-full">
                    <label htmlFor="purchase-merchant">Comercio</label>
                    <input
                      id="purchase-merchant"
                      value={purchaseMerchant}
                      onChange={(e) => setPurchaseMerchant(e.target.value)}
                      required
                      placeholder="Falabella"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="purchase-amount">Monto total</label>
                    <input
                      id="purchase-amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={purchaseAmount}
                      onChange={(e) => setPurchaseAmount(e.target.value)}
                      required
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="purchase-date">Fecha de compra</label>
                    <input
                      id="purchase-date"
                      type="date"
                      value={purchaseDate}
                      onChange={(e) => setPurchaseDate(e.target.value)}
                      required
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="purchase-installments">Número de cuotas</label>
                    <input
                      id="purchase-installments"
                      type="number"
                      min="1"
                      step="1"
                      value={purchaseInstallmentsTotal}
                      onChange={(e) => setPurchaseInstallmentsTotal(e.target.value)}
                      required
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="purchase-installment-amount">Monto de cada cuota</label>
                    <input
                      id="purchase-installment-amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={purchaseInstallmentAmount}
                      onChange={(e) => setPurchaseInstallmentAmount(e.target.value)}
                      required
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="purchase-installments-paid">Cuotas ya pagadas (opcional)</label>
                    <input
                      id="purchase-installments-paid"
                      type="number"
                      min="0"
                      step="1"
                      placeholder="0"
                      value={purchaseInstallmentsPaid}
                      onChange={(e) => setPurchaseInstallmentsPaid(e.target.value)}
                    />
                    <span style={{ fontSize: '0.8rem' }}>Úsalo para traer una compra que ya venía en curso.</span>
                  </div>
                  <button className="btn" type="submit" disabled={creatingPurchase}>
                    {creatingPurchase ? 'Guardando…' : 'Registrar compra'}
                  </button>
                </form>
              )}

              {cardPurchases.length === 0 ? (
                <p className="tx-empty">Todavía no hay compras a cuotas registradas.</p>
              ) : (
                <div className="purchases-grid">
                  {cardPurchases.map((purchase) => (
                    <CardPurchaseCard
                      key={purchase.id}
                      purchase={purchase}
                      payingAccounts={allAccounts.filter((a) => a.id !== accountId)}
                      onChange={updatePurchase}
                      onDeleted={removePurchase}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

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
              const isLinked = isTransfer || !!tx.goal || !!tx.loan || !!tx.cardPurchase
              return (
                <div className="tx-row" key={tx.id}>
                  {isTransfer ? (
                    <span className="tx-row-emoji">⇄</span>
                  ) : tx.goal ? (
                    <span className="tx-row-emoji">🎯</span>
                  ) : tx.loan ? (
                    <span className="tx-row-emoji">🏦</span>
                  ) : tx.cardPurchase ? (
                    <span className="tx-row-emoji">🛍️</span>
                  ) : (
                    tx.category?.emoji && <span className="tx-row-emoji">{tx.category.emoji}</span>
                  )}
                  <div className="tx-row-main">
                    <div className="tx-row-category">
                      {isTransfer
                        ? `Transferencia ${tx.type === 'EXPENSE' ? 'hacia' : 'desde'} ${tx.transferCounterpartyAccount?.name ?? ''}`
                        : tx.goal
                          ? `Meta: ${tx.goal.name}`
                          : tx.loan
                            ? `Préstamo: ${tx.loan.name}`
                            : tx.cardPurchase
                              ? `Compra: ${tx.cardPurchase.merchant}`
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
                  {isLinked ? (
                    <span className="tx-row-locked" title="Edítalo desde donde se originó">
                      🔒
                    </span>
                  ) : (
                    <button className="link-danger" onClick={() => handleDelete(tx)}>
                      ✕
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </Layout>
  )
}
