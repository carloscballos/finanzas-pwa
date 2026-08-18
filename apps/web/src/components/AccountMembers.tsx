import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import * as api from '../lib/api'
import { ApiError, type Account, type Invitation } from '../lib/api'
import { Badge } from './ui/Badge'
import { Button } from './ui/Button'
import { Card } from './ui/Card'
import { ListRow } from './ui/ListRow'
import { UserAutocomplete } from './UserAutocomplete'

export function AccountMembers({
  account,
  onAccountChange,
}: {
  account: Account
  onAccountChange: (account: Account) => void
}) {
  const { user, token } = useAuth()
  const [expanded, setExpanded] = useState(false)
  const [pendingInvites, setPendingInvites] = useState<Invitation[]>([])
  const [email, setEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)

  const isOwner = account.role === 'OWNER'

  useEffect(() => {
    if (!token || !expanded || !isOwner) return
    api
      .getAccountInvitations(token, account.id)
      .then((invs) => setPendingInvites(invs.filter((i) => i.status === 'PENDING')))
      .catch(() => {})
  }, [token, expanded, isOwner, account.id])

  async function refreshAccount() {
    if (!token) return
    const updated = await api.getAccount(token, account.id)
    onAccountChange(updated)
  }

  async function handleInvite(event: FormEvent) {
    event.preventDefault()
    if (!token) return
    setInviteError(null)
    setInviting(true)
    try {
      const invitation = await api.createInvitation(token, account.id, email)
      setPendingInvites((prev) => [invitation, ...prev])
      setEmail('')
    } catch (err) {
      setInviteError(err instanceof ApiError ? err.message : 'No se pudo enviar la invitación')
    } finally {
      setInviting(false)
    }
  }

  async function handleCancelInvite(invitation: Invitation) {
    if (!token) return
    try {
      await api.cancelInvitation(token, invitation.id)
      setPendingInvites((prev) => prev.filter((i) => i.id !== invitation.id))
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'No se pudo cancelar la invitación')
    }
  }

  async function handleRemove(memberUserId: string, isSelf: boolean) {
    if (!token) return
    const message = isSelf ? '¿Salir de esta cuenta?' : '¿Quitar a este miembro de la cuenta?'
    if (!confirm(message)) return
    try {
      await api.removeAccountMember(token, account.id, memberUserId)
      await refreshAccount()
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'No se pudo completar la acción')
    }
  }

  return (
    <Card className="members-section">
      <div className="members-section-header" onClick={() => setExpanded((v) => !v)}>
        <h2>Miembros ({account.memberCount})</h2>
        <span>{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <>
          <div className="members-list">
            {account.members.map((m) => {
              const isSelf = m.userId === user?.id
              const canRemove = isOwner ? m.role !== 'OWNER' : isSelf && m.role !== 'OWNER'
              return (
                <ListRow
                  key={m.userId}
                  title={
                    <>
                      {m.name} {isSelf && '(tú)'}
                    </>
                  }
                  subtitle={m.email}
                  trailing={<Badge tone={m.role === 'OWNER' ? 'ok' : 'neutral'}>{m.role === 'OWNER' ? 'Propietario' : 'Miembro'}</Badge>}
                  actions={
                    canRemove ? (
                      <button className="link-danger" onClick={() => handleRemove(m.userId, isSelf)}>
                        {isSelf ? 'Salir' : 'Quitar'}
                      </button>
                    ) : undefined
                  }
                />
              )
            })}
          </div>

          {isOwner && (
            <>
              <form className="invite-form" onSubmit={handleInvite}>
                <UserAutocomplete value={email} onChange={setEmail} placeholder="Email de la persona a invitar" />
                <Button type="submit" disabled={inviting}>
                  Invitar
                </Button>
              </form>
              {inviteError && (
                <div className="auth-error" style={{ marginTop: '0.5rem' }}>
                  {inviteError}
                </div>
              )}
              {pendingInvites.length > 0 && (
                <div className="pending-invites">
                  {pendingInvites.map((inv) => (
                    <div className="pending-invite-row" key={inv.id}>
                      <span>Invitación pendiente: {inv.invitedUser.email}</span>
                      <button className="link-danger" onClick={() => handleCancelInvite(inv)}>
                        Cancelar
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}
    </Card>
  )
}
