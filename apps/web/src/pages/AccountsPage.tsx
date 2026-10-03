import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Wallet } from 'lucide-react'
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
import { computeAvailableCredit, formatMoneyMaybeHidden } from '../lib/money'
import { usePrivacy } from '../context/PrivacyContext'
import './AccountsPage.css'

export function AccountsPage() {
  const { token } = useAuth()
  const { hideValues } = usePrivacy()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { open: showForm, toggle: toggleForm, close: closeForm } = useCreateFormToggle()

  useEffect(() => {
    if (!token) return
    api
      .getAccounts(token)
      .then(setAccounts)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Error al cargar cuentas'))
      .finally(() => setLoading(false))
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
          <Card key={account.id} accent>
            <CardHeader title={account.name} />
            <span className="account-type">{ACCOUNT_TYPE_LABELS[account.type]}</span>
            <Money amount={account.currentBalance} currency={account.currency} tone="balance" size="lg" />
            {account.type === 'CREDIT_CARD' && account.creditLimit !== null && (
              <div className="account-credit-info">
                Disponible: {formatMoneyMaybeHidden(computeAvailableCredit(account.creditLimit, account.currentBalance), account.currency, hideValues)} de{' '}
                {formatMoneyMaybeHidden(account.creditLimit, account.currency, hideValues)}
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
