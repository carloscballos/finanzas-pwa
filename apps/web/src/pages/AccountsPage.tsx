import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trash2, Wallet } from 'lucide-react'
import { AccountForm } from '../components/AccountForm'
import { Layout } from '../components/Layout'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card, CardHeader } from '../components/ui/Card'
import { CardGrid } from '../components/ui/CardGrid'
import { EmptyState } from '../components/ui/EmptyState'
import { Modal } from '../components/ui/Modal'
import { Money } from '../components/ui/Money'
import { SectionHeader } from '../components/ui/SectionHeader'
import { useCreateFormToggle } from '../components/ui/useCreateFormToggle'
import { useAuth } from '../context/AuthContext'
import * as api from '../lib/api'
import { ApiError, type Account } from '../lib/api'
import { ACCOUNT_TYPE_LABELS } from '../lib/accountTypeLabels'
import { onDataChanged } from '../lib/dataEvents'
import './AccountsPage.css'

export function AccountsPage() {
  const { token } = useAuth()
  const navigate = useNavigate()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { open: showForm, toggle: toggleForm, close: closeForm } = useCreateFormToggle()

  useEffect(() => {
    if (!token) return
    api
      .getAccounts(token)
      .then((all) => setAccounts(all.filter((a) => a.type !== 'CREDIT_CARD')))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Error al cargar cuentas'))
      .finally(() => setLoading(false))
  }, [token])

  useEffect(() => {
    if (!token) return
    return onDataChanged(() => {
      api
        .getAccounts(token)
        .then((all) => setAccounts(all.filter((a) => a.type !== 'CREDIT_CARD')))
        .catch(() => {})
    })
  }, [token])

  function handleCreated(account: Account) {
    setAccounts((prev) => [...prev, account])
    closeForm()
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
        <Button className="toolbar-create-btn" onClick={toggleForm}>
          + Nueva cuenta
        </Button>
      </SectionHeader>

      <Modal open={showForm} onClose={closeForm} title="Nueva cuenta">
        <AccountForm onCreated={handleCreated} />
      </Modal>

      {loading && <p>Cargando…</p>}
      {error && <div className="auth-error">{error}</div>}

      {!loading && !error && accounts.length === 0 && (
        <EmptyState>Todavía no tienes cuentas. Crea la primera arriba.</EmptyState>
      )}

      <CardGrid>
        {accounts.map((account) => (
          <Card
            key={account.id}
            accent
            interactive
            role="link"
            tabIndex={0}
            onClick={() => navigate(`/accounts/${account.id}/transactions`)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.target === e.currentTarget) navigate(`/accounts/${account.id}/transactions`)
            }}
          >
            <CardHeader
              title={account.name}
              actions={
                account.role === 'OWNER' ? (
                  <button
                    type="button"
                    className="icon-danger-btn"
                    title="Eliminar cuenta"
                    aria-label={`Eliminar la cuenta ${account.name}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(account)
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                ) : undefined
              }
            />
            <span className="account-type">{ACCOUNT_TYPE_LABELS[account.type]}</span>
            <Money amount={account.currentBalance} currency={account.currency} tone="balance" size="lg" />
            <div className="account-meta">
              <Badge tone={account.role === 'OWNER' ? 'ok' : 'neutral'}>
                {account.role === 'OWNER' ? 'Propietario' : 'Miembro'}
              </Badge>
              {account.memberCount > 1 && <Badge tone="neutral">Compartida · {account.memberCount}</Badge>}
            </div>
          </Card>
        ))}
      </CardGrid>
    </Layout>
  )
}
