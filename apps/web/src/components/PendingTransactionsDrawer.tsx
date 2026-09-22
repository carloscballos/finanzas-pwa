import { useState, useEffect } from 'react'
import { X, ChevronDown } from 'lucide-react'
import { Button } from './ui/Button'
import { Card, CardHeader } from './ui/Card'
import { Money } from './ui/Money'
import { Badge } from './ui/Badge'
import { FormField } from './ui/Form'
import * as api from '../lib/api'
import type { Transaction, Account, Category } from '../lib/api'
import { formatDateTime } from '../lib/dates'
import './PendingTransactionsDrawer.css'

interface Props {
  isOpen: boolean
  onClose: () => void
  token: string
  accounts: Account[]
  categories: Category[]
  onConfirmed?: () => void
}

export function PendingTransactionsDrawer({
  isOpen,
  onClose,
  token,
  accounts,
  categories,
  onConfirmed,
}: Props) {
  const [pending, setPending] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<{
    accountId: string
    categoryId: string
    note: string
    amount: number
    occurredAt: string
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isOpen || !token) return
    loadPending()
  }, [isOpen, token])

  async function loadPending() {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getPendingTransactions(token)
      setPending(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar pagos pendientes')
    } finally {
      setLoading(false)
    }
  }

  function startEdit(tx: Transaction) {
    setEditingId(tx.id)
    setEditForm({
      accountId: tx.account.id,
      categoryId: tx.category?.id ?? '',
      note: tx.note ?? '',
      amount: tx.amount,
      occurredAt: tx.occurredAt,
    })
  }

  async function saveEdit() {
    if (!editForm || !editingId) return
    if (!editForm.categoryId) {
      setError('La categoría es requerida')
      return
    }

    setSaving(true)
    setError(null)
    try {
      await api.updateTransaction(token, editingId, {
        accountId: editForm.accountId,
        categoryId: editForm.categoryId,
        note: editForm.note || undefined,
        amount: editForm.amount,
        occurredAt: editForm.occurredAt,
        status: 'CONFIRMED',
      })
      setEditingId(null)
      setEditForm(null)
      await loadPending()
      onConfirmed?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al confirmar')
    } finally {
      setSaving(false)
    }
  }

  const expenseCategories = categories.filter((c) => c.type === 'EXPENSE')
  const tx = editingId ? pending.find((t) => t.id === editingId) : null

  return (
    <>
      {isOpen && <div className="drawer-overlay" onClick={onClose} />}
      <div className={`pending-drawer ${isOpen ? 'open' : ''}`}>
        <div className="drawer-header">
          <h2>Pagos pendientes ({pending.length})</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X size={20} />
          </Button>
        </div>

        {error && <div className="drawer-error">{error}</div>}

        {loading ? (
          <div className="drawer-loading">Cargando...</div>
        ) : pending.length === 0 ? (
          <div className="drawer-empty">No tienes pagos pendientes</div>
        ) : editingId && editForm && tx ? (
          <div className="drawer-content">
            <div className="edit-form">
              <div className="form-row">
                <label>Monto</label>
                <input
                  type="number"
                  step="0.01"
                  value={editForm.amount}
                  onChange={(e) =>
                    setEditForm({ ...editForm, amount: parseFloat(e.target.value) })
                  }
                />
              </div>

              <div className="form-row">
                <label>Cuenta</label>
                <select
                  value={editForm.accountId}
                  onChange={(e) => setEditForm({ ...editForm, accountId: e.target.value })}
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.currency})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <label>Categoría *</label>
                <select
                  value={editForm.categoryId}
                  onChange={(e) => setEditForm({ ...editForm, categoryId: e.target.value })}
                >
                  <option value="">Selecciona una categoría</option>
                  {expenseCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.emoji ? `${c.emoji} ` : ''}
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <label>Descripción</label>
                <textarea
                  value={editForm.note}
                  onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
                  placeholder="p. ej. Pago de Wallet"
                  rows={2}
                />
              </div>

              <div className="form-row">
                <label>Fecha/Hora</label>
                <input
                  type="datetime-local"
                  value={editForm.occurredAt.slice(0, 16)}
                  onChange={(e) =>
                    setEditForm({ ...editForm, occurredAt: new Date(e.target.value).toISOString() })
                  }
                />
              </div>

              <div className="form-actions">
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditingId(null)
                    setEditForm(null)
                  }}
                >
                  Cancelar
                </Button>
                <Button onClick={saveEdit} disabled={saving}>
                  {saving ? 'Guardando...' : 'Confirmar'}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="drawer-content">
            <div className="pending-list">
              {pending.map((tx) => (
                <Card key={tx.id} className="pending-item">
                  <CardHeader className="pending-item-header">
                    <div className="pending-item-main">
                      <div>
                        <div className="pending-item-account">{tx.account.name}</div>
                        {tx.category ? (
                          <div className="pending-item-meta">
                            {tx.category.emoji && <span>{tx.category.emoji}</span>}
                            <span>{tx.category.name}</span>
                          </div>
                        ) : (
                          <Badge variant="outline">Sin categoría</Badge>
                        )}
                      </div>
                      <Money amount={tx.amount} currency={tx.account.currency} tone="negative" />
                    </div>
                    <div className="pending-item-meta-text">
                      {formatDateTime(new Date(tx.occurredAt))}
                      {tx.note && ` • ${tx.note}`}
                    </div>
                  </CardHeader>
                  <div className="pending-item-footer">
                    <Button size="sm" onClick={() => startEdit(tx)}>
                      Editar y confirmar
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
