import { useEffect, useState, type FormEvent } from 'react'
import { Trash2 } from 'lucide-react'
import { Badge } from './ui/Badge'
import { Button } from './ui/Button'
import { EmptyState } from './ui/EmptyState'
import { Form, FormError, FormField } from './ui/Form'
import { ListRow } from './ui/ListRow'
import { Modal } from './ui/Modal'
import { Money } from './ui/Money'
import * as api from '../lib/api'
import type { Account, Category, Transaction } from '../lib/api'
import { emitDataChanged } from '../lib/dataEvents'
import { dateTimeInputToIso, formatDateTime, isoToDateTimeInput } from '../lib/dates'
import { sanitizeDecimalInput } from '../lib/money'

interface Props {
  isOpen: boolean
  onClose: () => void
  token: string
  accounts: Account[]
  categories: Category[]
  onConfirmed?: () => void
}

/**
 * Pagos pendientes (los que registra el Shortcut de Wallet): se revisan uno a
 * uno eligiendo cuenta y categoría; hasta confirmarlos no mueven ningún saldo.
 */
export function PendingTransactionsDrawer({ isOpen, onClose, token, accounts, categories, onConfirmed }: Props) {
  const [pending, setPending] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [accountId, setAccountId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [date, setDate] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setEditing(null)
    setLoading(true)
    setError(null)
    api
      .getPendingTransactions(token)
      .then(setPending)
      .catch((err) => setError(err instanceof Error ? err.message : 'Error al cargar los pagos pendientes'))
      .finally(() => setLoading(false))
  }, [isOpen, token])

  function startReview(tx: Transaction) {
    setEditing(tx)
    setAccountId(tx.account.id)
    setCategoryId(tx.category?.id ?? '')
    setAmount(String(tx.amount))
    setNote(tx.note ?? '')
    setDate(isoToDateTimeInput(tx.occurredAt))
    setError(null)
  }

  // Cuando ya no queda ninguno por revisar, se cierra solo.
  function afterResolved(id: string) {
    const rest = pending.filter((t) => t.id !== id)
    setPending(rest)
    setEditing(null)
    emitDataChanged()
    onConfirmed?.()
    if (rest.length === 0) onClose()
  }

  async function handleConfirm(event: FormEvent) {
    event.preventDefault()
    if (!editing) return
    if (!categoryId) {
      setError('Elige una categoría')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await api.updateTransaction(token, editing.id, {
        accountId,
        categoryId,
        note: note || undefined,
        amount: Number(amount),
        occurredAt: dateTimeInputToIso(date),
        status: 'CONFIRMED',
      })
      afterResolved(editing.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo confirmar el pago')
    } finally {
      setSaving(false)
    }
  }

  async function handleDiscard(tx: Transaction) {
    if (!confirm('¿Descartar este pago pendiente? No se registrará.')) return
    try {
      await api.deleteTransaction(token, tx.id)
      afterResolved(tx.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo descartar el pago')
    }
  }

  const type = editing?.type ?? 'EXPENSE'
  const categoriesForType = categories.filter((c) => c.type === type)
  const accountOptions = accounts.filter((a) => a.type !== 'CREDIT_CARD')

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={editing ? 'Confirmar pago' : `Pagos pendientes${pending.length ? ` (${pending.length})` : ''}`}
    >
      {error && <div className="auth-error">{error}</div>}

      {editing ? (
        <Form onSubmit={handleConfirm}>
          <FormField label={`Monto (${editing.account.currency})`} htmlFor="pending-amount">
            <input
              id="pending-amount"
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(sanitizeDecimalInput(e.target.value))}
              required
            />
          </FormField>
          <FormField label="Fecha y hora" htmlFor="pending-date">
            <input id="pending-date" type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} required />
          </FormField>
          <FormField label="Cuenta" htmlFor="pending-account">
            <select id="pending-account" value={accountId} onChange={(e) => setAccountId(e.target.value)} required>
              {accountOptions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.currency})
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Categoría" htmlFor="pending-category">
            <select id="pending-category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
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
          </FormField>
          <FormField label="Nota (opcional)" htmlFor="pending-note" full>
            <input id="pending-note" value={note} onChange={(e) => setNote(e.target.value)} />
          </FormField>
          <FormError>{error}</FormError>
          <div className="ui-field-full" style={{ display: 'flex', gap: '0.5rem' }}>
            <Button type="submit" disabled={saving}>
              {saving ? 'Guardando…' : 'Confirmar'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setEditing(null)}>
              Volver
            </Button>
          </div>
        </Form>
      ) : loading ? (
        <p>Cargando…</p>
      ) : pending.length === 0 ? (
        <EmptyState>No tienes pagos pendientes.</EmptyState>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <p style={{ margin: 0, fontSize: '0.85rem' }}>
            Llegaron desde tu Shortcut. Elige la cuenta y la categoría para registrarlos: hasta entonces no afectan tus saldos.
          </p>
          {pending.map((tx) => (
            <ListRow
              key={tx.id}
              title={tx.note || 'Pago sin descripción'}
              subtitle={
                <>
                  {formatDateTime(tx.occurredAt)} {!tx.category && <Badge>Sin categoría</Badge>}
                </>
              }
              trailing={
                <Money
                  amount={tx.amount}
                  currency={tx.account.currency}
                  tone={tx.type === 'INCOME' ? 'positive' : 'negative'}
                />
              }
              actions={
                <>
                  <Button onClick={() => startReview(tx)}>Revisar</Button>
                  <button
                    type="button"
                    className="icon-danger-btn"
                    title="Descartar"
                    aria-label="Descartar pago pendiente"
                    onClick={() => handleDiscard(tx)}
                  >
                    <Trash2 size={16} />
                  </button>
                </>
              }
            />
          ))}
        </div>
      )}
    </Modal>
  )
}
