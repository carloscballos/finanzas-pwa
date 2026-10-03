import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CreditCard, Trash2 } from 'lucide-react'
import { AccountForm } from '../components/AccountForm'
import { Layout } from '../components/Layout'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card, CardHeader } from '../components/ui/Card'
import { CardGrid } from '../components/ui/CardGrid'
import { EmptyState } from '../components/ui/EmptyState'
import { Modal } from '../components/ui/Modal'
import { Money } from '../components/ui/Money'
import { ProgressBar, type ProgressTone } from '../components/ui/ProgressBar'
import { SectionHeader } from '../components/ui/SectionHeader'
import { useCreateFormToggle } from '../components/ui/useCreateFormToggle'
import { useAuth } from '../context/AuthContext'
import * as api from '../lib/api'
import { ApiError, type Account } from '../lib/api'
import { computeAvailableCredit } from '../lib/money'
import { onDataChanged } from '../lib/dataEvents'
import './AccountsPage.css'

function usageTone(percentUsed: number): ProgressTone {
  if (percentUsed >= 100) return 'error'
  if (percentUsed >= 70) return 'warn'
  return 'ok'
}

export function CardsPage() {
  const { token } = useAuth()
  const navigate = useNavigate()
  const [cards, setCards] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { open: showForm, toggle: toggleForm, close: closeForm } = useCreateFormToggle()

  useEffect(() => {
    if (!token) return
    api
      .getAccounts(token)
      .then((all) => setCards(all.filter((a) => a.type === 'CREDIT_CARD')))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Error al cargar las tarjetas'))
      .finally(() => setLoading(false))
  }, [token])

  useEffect(() => {
    if (!token) return
    return onDataChanged(() => {
      api
        .getAccounts(token)
        .then((all) => setCards(all.filter((a) => a.type === 'CREDIT_CARD')))
        .catch(() => {})
    })
  }, [token])

  async function handleDelete(card: Account) {
    if (!token) return
    if (!confirm(`¿Eliminar la tarjeta "${card.name}"? Esta acción no se puede deshacer.`)) return
    try {
      await api.deleteAccount(token, card.id)
      setCards((prev) => prev.filter((c) => c.id !== card.id))
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'No se pudo eliminar la tarjeta')
    }
  }

  return (
    <Layout fabActions={[{ label: 'Nueva tarjeta', icon: CreditCard, onClick: toggleForm }]}>
      <SectionHeader as="h1" title="Mis tarjetas">
        <Button className="toolbar-create-btn" onClick={toggleForm}>
          + Nueva tarjeta
        </Button>
      </SectionHeader>

      <Modal open={showForm} onClose={closeForm} title="Nueva tarjeta de crédito">
        <AccountForm
          kind="card"
          onCreated={(card) => {
            setCards((prev) => [...prev, card])
            closeForm()
          }}
        />
      </Modal>

      {loading && <p>Cargando…</p>}
      {error && <div className="auth-error">{error}</div>}

      {!loading && !error && cards.length === 0 && (
        <EmptyState>Todavía no tienes tarjetas de crédito. Crea la primera arriba.</EmptyState>
      )}

      <CardGrid>
        {cards.map((card) => {
          const hasLimit = card.creditLimit !== null && card.creditLimit > 0
          const used = Math.max(0, -card.currentBalance)
          const percentUsed = hasLimit ? (used / card.creditLimit!) * 100 : 0
          return (
            <Card
              key={card.id}
              accent
              interactive
              role="link"
              tabIndex={0}
              onClick={() => navigate(`/accounts/${card.id}/transactions`)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.target === e.currentTarget) navigate(`/accounts/${card.id}/transactions`)
              }}
            >
              <CardHeader
                title={card.name}
                actions={
                card.role === 'OWNER' ? (
                  <button
                    type="button"
                    className="icon-danger-btn"
                    title="Eliminar tarjeta"
                    aria-label={`Eliminar la tarjeta ${card.name}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(card)
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                ) : undefined
              }
              />
              {hasLimit ? (
                <>
                  <span className="account-type">Cupo disponible</span>
                  <Money
                    amount={computeAvailableCredit(card.creditLimit!, card.currentBalance)}
                    currency={card.currency}
                    tone="balance"
                    size="lg"
                  />
                  <ProgressBar value={percentUsed} tone={usageTone(percentUsed)} height={8} />
                  <div className="account-credit-info">
                    Usado <Money amount={used} currency={card.currency} /> de{' '}
                    <Money amount={card.creditLimit!} currency={card.currency} />
                  </div>
                </>
              ) : (
                <>
                  <span className="account-type">Saldo adeudado</span>
                  <Money amount={used} currency={card.currency} tone={used > 0 ? 'negative' : 'neutral'} size="lg" />
                </>
              )}
              <div className="account-meta">
                {card.paymentDueDay && <Badge tone="warn">Paga el día {card.paymentDueDay}</Badge>}
                <Badge tone={card.role === 'OWNER' ? 'ok' : 'neutral'}>
                  {card.role === 'OWNER' ? 'Propietario' : 'Miembro'}
                </Badge>
                {card.memberCount > 1 && <Badge tone="neutral">Compartida · {card.memberCount}</Badge>}
              </div>
            </Card>
          )
        })}
      </CardGrid>
    </Layout>
  )
}
