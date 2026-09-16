import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeftRight, Camera, FileUp, Receipt, ShoppingBag } from 'lucide-react'
import { Layout } from '../components/Layout'
import { AccountMembers } from '../components/AccountMembers'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { CardGrid } from '../components/ui/CardGrid'
import { EmptyState } from '../components/ui/EmptyState'
import { Form, FormField, FormError } from '../components/ui/Form'
import { IconChip } from '../components/ui/IconChip'
import { ListRow } from '../components/ui/ListRow'
import { Money } from '../components/ui/Money'
import { ProgressBar } from '../components/ui/ProgressBar'
import { SegmentedControl } from '../components/ui/SegmentedControl'
import { useCreateFormToggle } from '../components/ui/useCreateFormToggle'
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
import { ACCOUNT_TYPE_LABELS } from '../lib/accountTypeLabels'
import {
  dateInputToDateTimeInput,
  dateInputToIso,
  dateTimeInputToIso,
  formatDateOnly,
  formatDateTime,
  nowDateTimeInput,
  todayDateInput,
} from '../lib/dates'
import {
  computeAvailableCredit,
  estimateCuotaInterest,
  estimateInstallmentSplit,
  formatMoney,
  formatMoneyMaybeHidden,
  round2,
  sanitizeDecimalInput,
} from '../lib/money'
import { usePrivacy } from '../context/PrivacyContext'
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
  const [alreadyInBalance, setAlreadyInBalance] = useState(false)

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
        purchasedAt: item.purchasedAt,
        interestRate: item.interestRate,
        lastStatementInterestAmount: item.interestAmount,
        alreadyInBalance,
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
      // El extracto solo describe con precisión la cuota MÁS RECIENTE (la
      // que generó este BEHIND) — el interés real solo se aplica en el
      // último pago del loop. Las cuotas atrasadas intermedias quedan en $0
      // explícito en vez de adivinar: no tenemos su saldo/tasa histórica
      // para estimarlas, y fabricar un número parecería más preciso de lo
      // que es.
      for (let i = 0; i < item.cuotasBehind; i++) {
        const isLast = i === item.cuotasBehind - 1
        await api.payCardPurchaseInstallment(token, item.purchaseId, {
          accountId,
          interestAmount: isLast ? item.interestAmount : 0,
        })
      }
      onCaughtUp(item)
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'No se pudo poner al día')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ListRow
      title={item.merchant}
      subtitle={
        <>
          <div>
            {formatMoney(item.amount, cardCurrency)} · {item.installmentsTotal} cuota
            {item.installmentsTotal > 1 ? 's' : ''} de {formatMoney(item.installmentAmount, cardCurrency)}
            {!!item.interestAmount && ` + ${formatMoney(item.interestAmount, cardCurrency)} interés este mes`}
            {item.interestRate !== undefined && ` (${item.interestRate}%)`}
            {item.statementInstallmentCurrent && ` · extracto: cuota ${item.statementInstallmentCurrent}`}
            {item.matchType === 'NEW' && item.purchasedAt && ` · fecha: ${formatDateOnly(item.purchasedAt)}`}
          </div>
          {item.matchType === 'NEW' && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 400, marginTop: '0.25rem' }}>
              <input type="checkbox" checked={alreadyInBalance} onChange={(e) => setAlreadyInBalance(e.target.checked)} />
              Ya está en el saldo actual (no registrar movimiento)
            </label>
          )}
        </>
      }
      trailing={
        item.matchType === 'NEW' ? (
          <Button disabled={busy} onClick={handleCreate}>
            Crear compra
          </Button>
        ) : item.matchType === 'UP_TO_DATE' ? (
          <Badge tone="ok">Ya al día</Badge>
        ) : matchingAccounts.length === 0 ? (
          <span className="statement-row-meta">Sin cuenta en {cardCurrency} para pagar.</span>
        ) : (
          <div className="statement-row-catchup">
            <Badge tone="warn">Atrasada</Badge>
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
            <Button disabled={busy || !accountId} onClick={handleCatchUp}>
              Ponerme al día ({item.cuotasBehind} cuota{item.cuotasBehind !== 1 ? 's' : ''})
            </Button>
          </div>
        )
      }
      actions={
        <button className="link-danger" onClick={() => onDismiss(item)}>
          Ignorar
        </button>
      }
    />
  )
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
  const { hideValues } = usePrivacy()
  const matchingAccounts = payingAccounts.filter((a) => a.currency === purchase.account.currency)
  const [accountId, setAccountId] = useState('')
  const [amount, setAmount] = useState('')
  const [interestAmount, setInterestAmount] = useState('')
  const [payDate, setPayDate] = useState(nowDateTimeInput)
  const [busy, setBusy] = useState(false)

  // Precarga el interés de esta cuota — de preferencia el valor real del
  // último extracto conciliado (lastStatementInterestAmount), y solo si no
  // hay uno, un estimado por fórmula (% sobre lo pendiente). Se recalcula
  // cada vez que la compra cambia (al montar, y tras pagar, para la
  // siguiente cuota). Sigue editable: el real es exacto, pero el estimado es
  // un punto de partida por si el extracto real difiere.
  useEffect(() => {
    const value =
      purchase.lastStatementInterestAmount ??
      estimateCuotaInterest(purchase.remainingBalance, purchase.interestRate, purchase.installmentsPaid)
    setInterestAmount(value > 0 ? String(value) : '')
  }, [
    purchase.remainingBalance,
    purchase.interestRate,
    purchase.installmentsPaid,
    purchase.lastStatementInterestAmount,
  ])

  const [editing, setEditing] = useState(false)
  const [editInstallmentAmount, setEditInstallmentAmount] = useState('')
  const [editInterestRate, setEditInterestRate] = useState('')
  const [editBusy, setEditBusy] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  function startEditing() {
    setEditInstallmentAmount(String(purchase.installmentAmount))
    setEditInterestRate(purchase.interestRate === null ? '' : String(purchase.interestRate))
    setEditError(null)
    setEditing(true)
  }

  async function handleSaveEdit(event: FormEvent) {
    event.preventDefault()
    if (!token) return
    setEditBusy(true)
    setEditError(null)
    try {
      const updated = await api.updateCardPurchase(token, purchase.id, {
        installmentAmount: Number(editInstallmentAmount),
        interestRate: editInterestRate ? Number(editInterestRate) : undefined,
      })
      onChange(updated)
      setEditing(false)
    } catch (err) {
      setEditError(err instanceof ApiError ? err.message : 'No se pudo corregir la compra')
    } finally {
      setEditBusy(false)
    }
  }

  async function handlePay(event: FormEvent) {
    event.preventDefault()
    if (!token || !accountId) return
    setBusy(true)
    try {
      const updated = await api.payCardPurchaseInstallment(token, purchase.id, {
        accountId,
        amount: amount ? Number(amount) : undefined,
        interestAmount: interestAmount ? Number(interestAmount) : undefined,
        occurredAt: dateTimeInputToIso(payDate),
      })
      onChange(updated)
      setAmount('')
      setPayDate(nowDateTimeInput())
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
    <Card>
      <div className="loan-card-header">
        <div>
          <h3>{purchase.merchant}</h3>
          <span className="loan-meta">
            Cuota {purchase.installmentsPaid}/{purchase.installmentsTotal} de{' '}
            {formatMoneyMaybeHidden(purchase.installmentAmount, purchase.account.currency, hideValues)} ·{' '}
            {formatDateOnly(purchase.purchasedAt)}
            {purchase.interestRate !== null && ` · ${purchase.interestRate}% interés`}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="link" onClick={startEditing}>
            Editar
          </button>
          <button className="link-danger" onClick={handleDelete}>
            Eliminar
          </button>
        </div>
      </div>
      <ProgressBar value={purchase.percentPaid} tone="accent" />
      <div className="loan-amounts">
        <span>
          <Money amount={purchase.remainingBalance} currency={purchase.account.currency} /> pendiente
        </span>
        <span>{purchase.percentPaid}% pagado</span>
      </div>
      <div className="loan-amounts">
        <span>
          Original <Money amount={purchase.amount} currency={purchase.account.currency} />
        </span>
        <Badge tone={purchase.status === 'PAID_OFF' ? 'ok' : 'neutral'}>
          {purchase.status === 'PAID_OFF' ? 'Pagada' : 'Activa'}
        </Badge>
      </div>

      {editing && (
        <form className="loan-pay" onSubmit={handleSaveEdit}>
          <FormError>{editError}</FormError>
          <input
            type="number"
            step="0.01"
            min="0.01"
            aria-label="Monto de cada cuota"
            placeholder="Monto de cada cuota"
            value={editInstallmentAmount}
            onChange={(e) => setEditInstallmentAmount(sanitizeDecimalInput(e.target.value))}
            required
          />
          <input
            type="number"
            step="0.01"
            min="0"
            aria-label="% interés mensual"
            placeholder="% interés (opcional)"
            value={editInterestRate}
            onChange={(e) => setEditInterestRate(sanitizeDecimalInput(e.target.value))}
          />
          <Button type="submit" disabled={editBusy}>
            Guardar
          </Button>
          <Button type="button" variant="secondary" onClick={() => setEditing(false)}>
            Cancelar
          </Button>
        </form>
      )}

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
              placeholder={`Monto (cuota ${formatMoneyMaybeHidden(purchase.installmentAmount, purchase.account.currency, hideValues)})`}
              value={amount}
              onChange={(e) => setAmount(sanitizeDecimalInput(e.target.value))}
            />
            <input
              type="number"
              step="0.01"
              min="0.01"
              aria-label="Interés este mes"
              placeholder="Interés este mes (opcional)"
              value={interestAmount}
              onChange={(e) => setInterestAmount(sanitizeDecimalInput(e.target.value))}
              title="Precargado con remainingBalance × % interés — corrígelo con el valor real del extracto si difiere"
            />
            <input
              type="datetime-local"
              aria-label="Fecha y hora del pago"
              value={payDate}
              onChange={(e) => setPayDate(e.target.value)}
              required
            />
            <Button type="submit" disabled={busy || !accountId}>
              Pagar cuota
            </Button>
          </form>
        ))}
    </Card>
  )
}

// Multiplicador fromCurrency -> toCurrency a partir de la tasa USD/COP,
// solo para previsualizar en el formulario — el backend recalcula/valida la
// tasa real al crear la transferencia. `usdCopRate` es siempre "cuántos COP
// vale 1 USD" (lo que el usuario ve y edita, sin importar la dirección de la
// transferencia) — este helper lo convierte al multiplicador
// fromCurrency→toCurrency que de verdad se usa para calcular toAmount. Antes
// se guardaba directo el multiplicador (1/tasa al ir de COP a USD, un número
// como 0.00024) y se mostraba tal cual en el input — confuso.
function multiplierFromUsdCopRate(fromCurrency: string, toCurrency: string, usdCopRate: number): number | null {
  if (fromCurrency === toCurrency) return 1
  if (fromCurrency === 'USD' && toCurrency === 'COP') return usdCopRate
  // El backend valida el multiplicador con máximo 6 decimales — 1/tasa da un
  // float con muchos más (ej. 1/3101 = 0.000322476...), así que hay que
  // redondear antes de mandarlo, no solo al mostrarlo.
  if (fromCurrency === 'COP' && toCurrency === 'USD') return usdCopRate > 0 ? Math.round(1e6 / usdCopRate) / 1e6 : null
  return null
}

export function AccountTransactionsPage() {
  const { accountId } = useParams<{ accountId: string }>()
  const { token } = useAuth()
  const { hideValues } = usePrivacy()

  const [account, setAccount] = useState<Account | null>(null)
  const [allAccounts, setAllAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [cardPurchases, setCardPurchases] = useState<CardPurchase[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [statementPreview, setStatementPreview] = useState<StatementPreviewItem[] | null>(null)
  const [statementReconciliation, setStatementReconciliation] = useState<api.StatementReconciliation | null>(null)
  const [statementLoading, setStatementLoading] = useState(false)
  const [statementError, setStatementError] = useState<string | null>(null)
  const statementInputRef = useRef<HTMLInputElement>(null)
  // Flujo de PDF con contraseña: si el backend responde 422, guardamos el
  // archivo y pedimos la clave para reintentar sin volver a elegirlo.
  const [statementPendingFile, setStatementPendingFile] = useState<File | null>(null)
  const [statementPassword, setStatementPassword] = useState('')
  const [statementPasswordError, setStatementPasswordError] = useState<string | null>(null)

  const [showPayAllForm, setShowPayAllForm] = useState(false)
  const [payAllAccountId, setPayAllAccountId] = useState('')
  const [payAllAmount, setPayAllAmount] = useState('')
  const [payAllDate, setPayAllDate] = useState(nowDateTimeInput)
  const [payingAllBusy, setPayingAllBusy] = useState(false)
  const [payAllError, setPayAllError] = useState<string | null>(null)
  const [paidOffExpanded, setPaidOffExpanded] = useState(false)

  const [showPurchaseForm, setShowPurchaseForm] = useState(false)
  const [purchaseMerchant, setPurchaseMerchant] = useState('')
  const [purchaseAmount, setPurchaseAmount] = useState('')
  const [purchaseInstallmentsTotal, setPurchaseInstallmentsTotal] = useState('')
  const [purchaseInstallmentAmount, setPurchaseInstallmentAmount] = useState('')
  const [purchaseEstimatedInterest, setPurchaseEstimatedInterest] = useState('')
  const [purchaseInstallmentsPaid, setPurchaseInstallmentsPaid] = useState('')
  const [purchaseDate, setPurchaseDate] = useState(todayDateInput)
  const [purchaseInterestRate, setPurchaseInterestRate] = useState('')
  const [purchaseAlreadyInBalance, setPurchaseAlreadyInBalance] = useState(false)
  const [creatingPurchase, setCreatingPurchase] = useState(false)
  const [purchaseFormError, setPurchaseFormError] = useState<string | null>(null)

  const { open: showForm, toggle: toggleForm, close: closeForm } = useCreateFormToggle()
  const [type, setType] = useState<TransactionType>('EXPENSE')
  const [categoryId, setCategoryId] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(nowDateTimeInput)
  const [saveAsTemplate, setSaveAsTemplate] = useState(false)
  const [templateFrequency, setTemplateFrequency] = useState<RecurrenceFrequency>('MONTHLY')
  const [creating, setCreating] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [receiptLoading, setReceiptLoading] = useState(false)
  const receiptInputRef = useRef<HTMLInputElement>(null)

  const [showTransferForm, setShowTransferForm] = useState(false)
  const [toAccountId, setToAccountId] = useState('')
  const [transferAmount, setTransferAmount] = useState('')
  const [transferNote, setTransferNote] = useState('')
  const [transferDate, setTransferDate] = useState(nowDateTimeInput)
  const [autoRate, setAutoRate] = useState<api.ExchangeRate | null>(null)
  // Siempre "cuántos COP vale 1 USD" — nunca el multiplicador crudo de la
  // transferencia (ver multiplierFromUsdCopRate).
  const [usdCopRate, setUsdCopRate] = useState('')
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

  // Corre el preview del extracto. Si el PDF está cifrado, el backend responde
  // 422 (pedir contraseña) o 400 (contraseña incorrecta); todo lo demás es un
  // error normal. `password` va solo cuando se reintenta tras pedir la clave.
  async function runStatementPreview(file: File, password?: string) {
    if (!token || !accountId) return
    setStatementError(null)
    setStatementPasswordError(null)
    setStatementLoading(true)
    setStatementPreview(null)
    setStatementReconciliation(null)
    try {
      const preview = await api.previewCardStatement(token, accountId, file, password)
      setStatementPreview(preview.items)
      setStatementReconciliation(preview.reconciliation)
      // Éxito: limpiar cualquier estado de contraseña pendiente.
      setStatementPendingFile(null)
      setStatementPassword('')
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        // El PDF necesita contraseña: guardar el archivo y pedirla.
        setStatementPendingFile(file)
        setStatementPassword('')
        setStatementPasswordError(null)
      } else if (err instanceof ApiError && err.status === 400 && password) {
        // Contraseña incorrecta en el reintento: mantener el formulario abierto.
        setStatementPendingFile(file)
        setStatementPasswordError(err.message)
      } else {
        setStatementPendingFile(null)
        setStatementError(err instanceof ApiError ? err.message : 'No se pudo leer el extracto')
      }
    } finally {
      setStatementLoading(false)
    }
  }

  async function handleStatementFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setStatementPendingFile(null)
    setStatementPassword('')
    setStatementPasswordError(null)
    await runStatementPreview(file)
  }

  async function submitStatementPassword(event: FormEvent) {
    event.preventDefault()
    if (!statementPendingFile || !statementPassword) return
    await runStatementPreview(statementPendingFile, statementPassword)
  }

  function cancelStatementPassword() {
    setStatementPendingFile(null)
    setStatementPassword('')
    setStatementPasswordError(null)
  }

  function removeStatementItem(item: StatementPreviewItem) {
    setStatementPreview((prev) => (prev ? prev.filter((i) => i !== item) : prev))
  }

  async function handleStatementItemDone(item: StatementPreviewItem) {
    removeStatementItem(item)
    await refreshAll()
  }

  function openPayAllForm() {
    setPayAllAccountId('')
    const estimatedTotal = round2(activeMonthlyInstallments + activeMonthlyInterestEstimate)
    setPayAllAmount(estimatedTotal > 0 ? String(estimatedTotal) : '')
    setPayAllDate(nowDateTimeInput())
    setPayAllError(null)
    setShowPayAllForm(true)
  }

  // Un solo movimiento por el total (no uno por compra) — el backend crea
  // una Transfer real entre las dos cuentas y, en la misma transacción de
  // BD, avanza installmentsPaid/remainingBalance de cada compra activa.
  async function handlePayAllInstallments(event: FormEvent) {
    event.preventDefault()
    if (!token || !accountId || !payAllAccountId) return
    setPayingAllBusy(true)
    setPayAllError(null)
    try {
      await api.payMonthlyInstallments(token, {
        cardAccountId: accountId,
        payingAccountId: payAllAccountId,
        amount: payAllAmount ? Number(payAllAmount) : undefined,
        occurredAt: dateTimeInputToIso(payAllDate),
      })
      await refreshAll()
      setShowPayAllForm(false)
    } catch (err) {
      setPayAllError(err instanceof ApiError ? err.message : 'No se pudo pagar la cuota del mes')
    } finally {
      setPayingAllBusy(false)
    }
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
        purchasedAt: dateInputToIso(purchaseDate),
        interestRate: purchaseInterestRate ? Number(purchaseInterestRate) : undefined,
        alreadyInBalance: purchaseAlreadyInBalance,
      })
      const updatedTxs = await api.getTransactions(token, { accountId })
      setTransactions(updatedTxs)
      await refreshAccountAndPurchases()
      setPurchaseMerchant('')
      setPurchaseAmount('')
      setPurchaseInstallmentsTotal('')
      setPurchaseInstallmentAmount('')
      setPurchaseEstimatedInterest('')
      setPurchaseInstallmentsPaid('')
      setPurchaseDate(todayDateInput())
      setPurchaseInterestRate('')
      setPurchaseAlreadyInBalance(false)
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
    if (!needsRate || !autoRate) return
    // autoRate.rate YA es "1 USD en COP" — se precarga tal cual, sin
    // importar en qué dirección va la transferencia.
    setUsdCopRate(String(round2(autoRate.rate)))
  }, [autoRate, needsRate])

  const previewRate = needsRate
    ? account && toAccount
      ? multiplierFromUsdCopRate(account.currency, toAccount.currency, Number(usdCopRate) || 0)
      : null
    : 1
  const previewToAmount =
    transferAmount && previewRate ? Number(transferAmount) * previewRate : null

  const activeCardPurchases = cardPurchases.filter((p) => p.status === 'ACTIVE')
  const paidOffCardPurchases = cardPurchases.filter((p) => p.status === 'PAID_OFF')
  const activeMonthlyInstallments = activeCardPurchases.reduce((sum, p) => sum + p.installmentAmount, 0)
  const activeMonthlyInterestEstimate = activeCardPurchases.reduce(
    (sum, p) =>
      sum +
      (p.lastStatementInterestAmount ?? estimateCuotaInterest(p.remainingBalance, p.interestRate, p.installmentsPaid)),
    0,
  )
  const payAllMatchingAccounts = allAccounts.filter(
    (a) => a.id !== accountId && account && a.currency === account.currency,
  )

  const categoriesForType = categories.filter((c) => c.type === type)

  function selectType(next: TransactionType) {
    setType(next)
    setCategoryId('')
  }

  // Solo sugiere: pre-llena el form de "Nuevo movimiento" con lo que la IA
  // leyó de la foto, pero no crea nada — el usuario revisa/edita y decide si
  // le da a "Registrar movimiento" como con cualquier otro movimiento.
  async function handleReceiptFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!token || !file) return
    setReceiptLoading(true)
    try {
      const extracted = await api.extractReceipt(token, file)
      setType('EXPENSE')
      setCategoryId(extracted.suggestedCategory?.id ?? '')
      setAmount(extracted.amount ? String(extracted.amount) : '')
      setNote(extracted.merchant)
      // La factura solo da el día (si lo da) — la hora queda a mediodía y el
      // usuario la ajusta si le importa.
      setDate(extracted.occurredAt ? dateInputToDateTimeInput(extracted.occurredAt) : nowDateTimeInput())
      if (!showForm) toggleForm()
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'No se pudo leer la factura')
    } finally {
      setReceiptLoading(false)
    }
  }

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
        occurredAt: dateTimeInputToIso(date),
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
      setDate(nowDateTimeInput())
      setSaveAsTemplate(false)
      closeForm()
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
        exchangeRate:
          needsRate && account && toAccount && usdCopRate
            ? (multiplierFromUsdCopRate(account.currency, toAccount.currency, Number(usdCopRate)) ?? undefined)
            : undefined,
        note: transferNote || undefined,
        occurredAt: dateTimeInputToIso(transferDate),
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
      setUsdCopRate('')
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
              { label: 'Nuevo movimiento', icon: Receipt, onClick: toggleForm },
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
              <p className="ui-section-header-subtitle">{ACCOUNT_TYPE_LABELS[account.type]}</p>
              <Money amount={account.currentBalance} currency={account.currency} tone="balance" size="lg" />
              {account.type === 'CREDIT_CARD' && account.creditLimit !== null && (
                <div className="account-credit-info">
                  Disponible: {formatMoneyMaybeHidden(computeAvailableCredit(account.creditLimit, account.currentBalance), account.currency, hideValues)} de{' '}
                  {formatMoneyMaybeHidden(account.creditLimit, account.currency, hideValues)}
                  {account.paymentDueDay && ` · Paga el día ${account.paymentDueDay}`}
                </div>
              )}
            </div>
            <div className="tx-header-actions">
              <input
                ref={receiptInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                capture="environment"
                style={{ display: 'none' }}
                onChange={handleReceiptFile}
              />
              <Button variant="secondary" disabled={receiptLoading} onClick={() => receiptInputRef.current?.click()}>
                {receiptLoading ? 'Leyendo…' : <><Camera size={16} /> Escanear factura</>}
              </Button>
              <Button
                variant="secondary"
                className={showTransferForm ? '' : 'toolbar-create-btn'}
                onClick={() => setShowTransferForm((v) => !v)}
              >
                {showTransferForm ? 'Cancelar' : 'Transferir'}
              </Button>
              <Button className={showForm ? '' : 'toolbar-create-btn'} onClick={toggleForm}>
                {showForm ? 'Cancelar' : '+ Nuevo movimiento'}
              </Button>
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
                  <Button variant="secondary" disabled={statementLoading} onClick={() => statementInputRef.current?.click()}>
                    {statementLoading ? 'Leyendo…' : <><FileUp size={16} /> Subir extracto</>}
                  </Button>
                  <Button
                    variant="secondary"
                    className={showPurchaseForm ? '' : 'toolbar-create-btn'}
                    onClick={() => setShowPurchaseForm((v) => !v)}
                  >
                    {showPurchaseForm ? 'Cancelar' : '+ Nueva compra'}
                  </Button>
                </div>
              </div>

              {activeMonthlyInstallments > 0 && (
                <div
                  className="account-credit-info"
                  style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}
                >
                  <span>Cuota estimada este mes: {formatMoneyMaybeHidden(activeMonthlyInstallments, account.currency, hideValues)}</span>
                  {payAllMatchingAccounts.length === 0 ? (
                    <span className="statement-row-meta">Sin cuenta en {account.currency} para pagar.</span>
                  ) : !showPayAllForm ? (
                    <Button onClick={openPayAllForm}>Pagar cuota del mes</Button>
                  ) : null}
                </div>
              )}

              {showPayAllForm && (
                <Card className="ui-form-card">
                  <Form onSubmit={handlePayAllInstallments}>
                    <FormError>{payAllError}</FormError>
                    <FormField label="Cuenta" htmlFor="payall-account">
                      <select
                        id="payall-account"
                        value={payAllAccountId}
                        onChange={(e) => setPayAllAccountId(e.target.value)}
                        required
                      >
                        <option value="" disabled>
                          Elige una
                        </option>
                        {payAllMatchingAccounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                    </FormField>
                    <FormField label="Monto total (capital + interés estimado)" htmlFor="payall-amount">
                      <input
                        id="payall-amount"
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={payAllAmount}
                        onChange={(e) => setPayAllAmount(sanitizeDecimalInput(e.target.value))}
                      />
                      <span style={{ fontSize: '0.8rem' }}>
                        Precargado con capital ({formatMoneyMaybeHidden(activeMonthlyInstallments, account.currency, hideValues)}) + interés
                        estimado ({formatMoneyMaybeHidden(activeMonthlyInterestEstimate, account.currency, hideValues)}) — corrígelo con el
                        valor real del extracto. Solo el capital de cada cuota se descuenta del saldo pendiente de las
                        compras; el interés no afecta el saldo de la tarjeta.
                      </span>
                    </FormField>
                    <FormField label="Fecha" htmlFor="payall-date">
                      <input
                        id="payall-date"
                        type="datetime-local"
                        value={payAllDate}
                        onChange={(e) => setPayAllDate(e.target.value)}
                        required
                      />
                    </FormField>
                    <Button type="submit" disabled={payingAllBusy || !payAllAccountId}>
                      {payingAllBusy ? 'Pagando…' : 'Registrar pago'}
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => setShowPayAllForm(false)}>
                      Cancelar
                    </Button>
                  </Form>
                </Card>
              )}

              {statementError && (
                <div className="auth-error" style={{ marginBottom: '1rem' }}>
                  {statementError}
                </div>
              )}

              {statementPendingFile && (
                <Card className="ui-form-card">
                  <Form onSubmit={submitStatementPassword}>
                    <FormError>{statementPasswordError}</FormError>
                    <p style={{ margin: '0 0 0.25rem', fontSize: '0.9rem' }}>
                      El PDF <strong>{statementPendingFile.name}</strong> está protegido con contraseña. Ingrésala para leer el extracto.
                    </p>
                    <FormField label="Contraseña del PDF" htmlFor="statement-password">
                      <input
                        id="statement-password"
                        type="password"
                        autoComplete="off"
                        autoFocus
                        value={statementPassword}
                        onChange={(e) => setStatementPassword(e.target.value)}
                        placeholder="La contraseña con la que abres el PDF"
                      />
                    </FormField>
                    <Button type="submit" disabled={statementLoading || !statementPassword}>
                      {statementLoading ? 'Leyendo…' : 'Desbloquear y leer'}
                    </Button>
                    <Button type="button" variant="secondary" onClick={cancelStatementPassword}>
                      Cancelar
                    </Button>
                  </Form>
                </Card>
              )}

              {statementReconciliation && (
                <Card style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <Badge tone={statementReconciliation.ok ? 'ok' : 'error'}>
                      {statementReconciliation.ok ? 'El extracto cuadra' : 'El extracto no cuadra'}
                    </Badge>
                  </div>
                  {!statementReconciliation.ok && (
                    <p style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                      La suma de lo que se leyó no coincide con los totales impresos en el extracto — puede faltar o
                      sobrar una línea. Revisa antes de aceptar las compras de abajo.
                    </p>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    {statementReconciliation.checks.map((check) => (
                      <div
                        key={check.code}
                        style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', fontSize: '0.85rem' }}
                      >
                        <span>
                          {check.ok ? '✓' : '✕'} {check.label}
                        </span>
                        <span>
                          {formatMoney(check.calculated, account.currency)} vs {formatMoney(check.reported, account.currency)}
                          {!check.ok && ` · dif. ${formatMoney(check.difference, account.currency)}`}
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {statementPreview && (
                <div className="statement-preview">
                  {statementPreview.length === 0 ? (
                    <EmptyState>Ya procesaste todo lo del extracto.</EmptyState>
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
                <Card className="ui-form-card">
                  <Form onSubmit={handleCreatePurchase}>
                    <FormError>{purchaseFormError}</FormError>
                    <FormField label="Comercio" htmlFor="purchase-merchant" full>
                      <input
                        id="purchase-merchant"
                        value={purchaseMerchant}
                        onChange={(e) => setPurchaseMerchant(e.target.value)}
                        required
                        placeholder="Falabella"
                      />
                    </FormField>
                    <FormField label="Monto total" htmlFor="purchase-amount">
                      <input
                        id="purchase-amount"
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={purchaseAmount}
                        onChange={(e) => setPurchaseAmount(sanitizeDecimalInput(e.target.value))}
                        required
                      />
                    </FormField>
                    <FormField label="Fecha de compra" htmlFor="purchase-date">
                      <input
                        id="purchase-date"
                        type="date"
                        value={purchaseDate}
                        onChange={(e) => setPurchaseDate(e.target.value)}
                        required
                      />
                    </FormField>
                    <FormField label="Número de cuotas" htmlFor="purchase-installments">
                      <input
                        id="purchase-installments"
                        type="number"
                        min="1"
                        step="1"
                        value={purchaseInstallmentsTotal}
                        onChange={(e) => setPurchaseInstallmentsTotal(sanitizeDecimalInput(e.target.value, 0))}
                        required
                      />
                    </FormField>
                    <FormField label="% interés mensual (opcional)" htmlFor="purchase-interest-rate">
                      <input
                        id="purchase-interest-rate"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0"
                        value={purchaseInterestRate}
                        onChange={(e) => setPurchaseInterestRate(sanitizeDecimalInput(e.target.value))}
                      />
                    </FormField>
                    <FormField label="Monto de cada cuota (capital, sin interés)" htmlFor="purchase-installment-amount">
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input
                          id="purchase-installment-amount"
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={purchaseInstallmentAmount}
                          onChange={(e) => setPurchaseInstallmentAmount(sanitizeDecimalInput(e.target.value))}
                          required
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={!purchaseAmount || !purchaseInstallmentsTotal}
                          onClick={() => {
                            const { capital, interest } = estimateInstallmentSplit(
                              Number(purchaseAmount),
                              Number(purchaseInterestRate || 0),
                              Number(purchaseInstallmentsTotal),
                              Number(purchaseInstallmentsPaid || 0),
                            )
                            setPurchaseInstallmentAmount(String(capital))
                            setPurchaseEstimatedInterest(interest > 0 ? String(interest) : '')
                          }}
                        >
                          Estimar
                        </Button>
                      </div>
                      <span style={{ fontSize: '0.8rem' }}>
                        El capital es principal/cuotas, igual que en el extracto real — nunca incluye interés, porque
                        el banco lo cobra aparte y no debe afectar el saldo de la tarjeta.
                      </span>
                    </FormField>
                    <FormField label="Interés estimado de la cuota (opcional, solo referencia)" htmlFor="purchase-estimated-interest">
                      <input
                        id="purchase-estimated-interest"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0"
                        value={purchaseEstimatedInterest}
                        onChange={(e) => setPurchaseEstimatedInterest(sanitizeDecimalInput(e.target.value))}
                      />
                      <span style={{ fontSize: '0.8rem' }}>
                        No se guarda — es solo para comparar contra el extracto real al pagar la cuota, donde sí puedes
                        especificar el interés del mes.
                      </span>
                    </FormField>
                    <FormField label="Cuotas ya pagadas (opcional)" htmlFor="purchase-installments-paid">
                      <input
                        id="purchase-installments-paid"
                        type="number"
                        min="0"
                        step="1"
                        placeholder="0"
                        value={purchaseInstallmentsPaid}
                        onChange={(e) => setPurchaseInstallmentsPaid(sanitizeDecimalInput(e.target.value, 0))}
                      />
                      <span style={{ fontSize: '0.8rem' }}>Úsalo para traer una compra que ya venía en curso.</span>
                    </FormField>
                    <div className="ui-field-full">
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 400 }}>
                        <input
                          type="checkbox"
                          checked={purchaseAlreadyInBalance}
                          onChange={(e) => setPurchaseAlreadyInBalance(e.target.checked)}
                        />
                        Ya está incluida en el saldo actual de la tarjeta (no registrar un movimiento nuevo)
                      </label>
                    </div>
                    <Button type="submit" disabled={creatingPurchase}>
                      {creatingPurchase ? 'Guardando…' : 'Registrar compra'}
                    </Button>
                  </Form>
                </Card>
              )}

              {activeCardPurchases.length === 0 ? (
                <EmptyState>Todavía no hay compras a cuotas activas.</EmptyState>
              ) : (
                <CardGrid minWidth={280}>
                  {activeCardPurchases.map((purchase) => (
                    <CardPurchaseCard
                      key={purchase.id}
                      purchase={purchase}
                      payingAccounts={allAccounts.filter((a) => a.id !== accountId)}
                      onChange={updatePurchase}
                      onDeleted={removePurchase}
                    />
                  ))}
                </CardGrid>
              )}

              {paidOffCardPurchases.length > 0 && (
                <Card className="members-section" style={{ marginTop: '1rem' }}>
                  <div className="members-section-header" onClick={() => setPaidOffExpanded((v) => !v)}>
                    <h2>Compras pagadas ({paidOffCardPurchases.length})</h2>
                    <span>{paidOffExpanded ? '▲' : '▼'}</span>
                  </div>
                  {paidOffExpanded && (
                    <CardGrid minWidth={280}>
                      {paidOffCardPurchases.map((purchase) => (
                        <CardPurchaseCard
                          key={purchase.id}
                          purchase={purchase}
                          payingAccounts={allAccounts.filter((a) => a.id !== accountId)}
                          onChange={updatePurchase}
                          onDeleted={removePurchase}
                        />
                      ))}
                    </CardGrid>
                  )}
                </Card>
              )}
            </section>
          )}

          {showTransferForm && (
            <Card className="ui-form-card">
              <Form onSubmit={handleTransfer}>
                <FormError>{transferError}</FormError>
                <FormField label="Cuenta destino" htmlFor="transfer-to">
                  <select
                    id="transfer-to"
                    value={toAccountId}
                    onChange={(e) => {
                      setToAccountId(e.target.value)
                      setUsdCopRate('')
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
                </FormField>
                <FormField label={`Monto (${account.currency})`} htmlFor="transfer-amount">
                  <input
                    id="transfer-amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(sanitizeDecimalInput(e.target.value))}
                    required
                  />
                </FormField>
                <FormField label="Fecha y hora" htmlFor="transfer-date">
                  <input
                    id="transfer-date"
                    type="datetime-local"
                    value={transferDate}
                    onChange={(e) => setTransferDate(e.target.value)}
                    required
                  />
                </FormField>
                {needsRate && (
                  <FormField label="Valor de 1 USD (en COP)" htmlFor="transfer-rate">
                    <input
                      id="transfer-rate"
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={usdCopRate}
                      onChange={(e) => setUsdCopRate(sanitizeDecimalInput(e.target.value))}
                      placeholder={autoRate ? undefined : 'Sin tasa automática — ingrésala'}
                      required
                    />
                  </FormField>
                )}
                {toAccount && previewToAmount !== null && (
                  <div className="ui-field-full transfer-preview">
                    Recibe en {toAccount.name}:{' '}
                    <strong>{formatMoneyMaybeHidden(previewToAmount, toAccount.currency, hideValues)}</strong>
                    {needsRate && autoRate && (
                      <span className="tx-row-meta"> · TRM oficial del {autoRate.date.slice(0, 10)}</span>
                    )}
                  </div>
                )}
                <FormField label="Nota (opcional)" htmlFor="transfer-note" full>
                  <input id="transfer-note" value={transferNote} onChange={(e) => setTransferNote(e.target.value)} />
                </FormField>
                <Button type="submit" disabled={transferring}>
                  {transferring ? 'Transfiriendo…' : 'Transferir'}
                </Button>
              </Form>
            </Card>
          )}

          {showForm && (
            <Card className="ui-form-card">
              <Form onSubmit={handleCreate}>
                <FormError>{formError}</FormError>
                <div className="ui-field-full">
                  <SegmentedControl<TransactionType>
                    value={type}
                    onChange={selectType}
                    options={[
                      { value: 'EXPENSE', label: 'Gasto', tone: 'error' },
                      { value: 'INCOME', label: 'Ingreso', tone: 'ok' },
                    ]}
                  />
                </div>
                <FormField label="Categoría" htmlFor="tx-category">
                  <select id="tx-category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
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
                </FormField>
                <FormField label="Monto" htmlFor="tx-amount">
                  <input
                    id="tx-amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={amount}
                    onChange={(e) => setAmount(sanitizeDecimalInput(e.target.value))}
                    required
                  />
                </FormField>
                <FormField label="Fecha y hora" htmlFor="tx-date">
                  <input id="tx-date" type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} required />
                </FormField>
                <FormField label="Nota (opcional)" htmlFor="tx-note" full>
                  <input id="tx-note" value={note} onChange={(e) => setNote(e.target.value)} />
                </FormField>
                <div className="ui-field-full tx-template-toggle">
                  <label>
                    <input type="checkbox" checked={saveAsTemplate} onChange={(e) => setSaveAsTemplate(e.target.checked)} />
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
                <Button type="submit" disabled={creating}>
                  {creating ? 'Guardando…' : 'Registrar movimiento'}
                </Button>
              </Form>
            </Card>
          )}

          {transactions.length === 0 && <EmptyState>Todavía no hay movimientos.</EmptyState>}

          <div className="tx-list">
            {transactions.map((tx) => {
              const isTransfer = !!tx.transferId
              // Las patas de meta/préstamo/compra/deuda solo se editan/eliminan
              // desde donde se originaron (no hay endpoint para borrarlas
              // sueltas) — una transferencia sí tiene su propio DELETE
              // (/transfers/:id, borra sus dos patas), así que no se bloquea.
              const isLockedElsewhere = !!tx.goal || !!tx.loan || !!tx.cardPurchase || !!tx.debt
              const emoji = isTransfer
                ? '⇄'
                : tx.goal
                  ? '🎯'
                  : tx.loan
                    ? '🏦'
                    : tx.cardPurchase
                      ? '🛍️'
                      : tx.debt
                        ? '🤝'
                        : tx.category?.emoji

              return (
                <ListRow
                  key={tx.id}
                  leading={<IconChip tone={tx.type === 'INCOME' ? 'ok' : 'error'}>{emoji}</IconChip>}
                  title={
                    isTransfer
                      ? `Transferencia ${tx.type === 'EXPENSE' ? 'hacia' : 'desde'} ${tx.transferCounterpartyAccount?.name ?? ''}`
                      : tx.goal
                        ? `Meta: ${tx.goal.name}`
                        : tx.loan
                          ? `Préstamo: ${tx.loan.name}`
                          : tx.cardPurchase
                            ? `Compra: ${tx.cardPurchase.merchant}`
                            : tx.debt
                              ? `Deuda: ${tx.debt.counterpartyName}`
                              : tx.category?.name
                  }
                  subtitle={
                    (tx.note || account.memberCount > 1) && (
                      <>
                        {tx.note && <div className="tx-row-note">{tx.note}</div>}
                        {account.memberCount > 1 && <div className="tx-row-creator">{tx.createdBy.name}</div>}
                      </>
                    )
                  }
                  trailing={
                    <>
                      <div className="tx-row-date">{formatDateTime(tx.occurredAt)}</div>
                      <Money
                        amount={tx.amount}
                        currency={tx.account.currency}
                        tone={tx.type === 'INCOME' ? 'positive' : 'negative'}
                        showSign
                      />
                    </>
                  }
                  actions={
                    isLockedElsewhere ? (
                      <span className="tx-row-locked" title="Edítalo desde donde se originó">
                        🔒
                      </span>
                    ) : (
                      <button className="link-danger" onClick={() => handleDelete(tx)}>
                        ✕
                      </button>
                    )
                  }
                />
              )
            })}
          </div>
        </>
      )}
    </Layout>
  )
}
