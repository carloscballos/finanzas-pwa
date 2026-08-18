import { useEffect, useState } from 'react'
import { Layout } from '../components/Layout'
import { Badge, type BadgeTone } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { ListRow } from '../components/ui/ListRow'
import { SectionHeader } from '../components/ui/SectionHeader'
import { useAuth } from '../context/AuthContext'
import * as api from '../lib/api'
import { ApiError, type Invitation } from '../lib/api'
import './InvitationsPage.css'

function statusBadge(status: Invitation['status']): { label: string; tone: BadgeTone } {
  if (status === 'ACCEPTED') return { label: 'Aceptada', tone: 'ok' }
  if (status === 'DECLINED') return { label: 'Rechazada', tone: 'error' }
  if (status === 'CANCELED') return { label: 'Cancelada', tone: 'neutral' }
  return { label: 'Pendiente', tone: 'warn' }
}

export function InvitationsPage() {
  const { token } = useAuth()
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    api
      .getMyInvitations(token)
      .then(setInvitations)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Error al cargar invitaciones'))
      .finally(() => setLoading(false))
  }, [token])

  async function respond(invitation: Invitation, action: (t: string, id: string) => Promise<Invitation>) {
    if (!token) return
    setBusyId(invitation.id)
    try {
      const updated = await action(token, invitation.id)
      setInvitations((prev) => prev.map((i) => (i.id === updated.id ? updated : i)))
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'No se pudo procesar la invitación')
    } finally {
      setBusyId(null)
    }
  }

  const pending = invitations.filter((i) => i.status === 'PENDING')
  const others = invitations.filter((i) => i.status !== 'PENDING')

  return (
    <Layout>
      <SectionHeader as="h1" title="Invitaciones" />

      {loading && <p>Cargando…</p>}
      {error && <div className="auth-error">{error}</div>}

      {!loading && !error && invitations.length === 0 && <EmptyState>No tienes invitaciones.</EmptyState>}

      <div className="invitations-list">
        {pending.map((inv) => {
          const badge = statusBadge(inv.status)
          return (
            <ListRow
              key={inv.id}
              title={inv.account.name}
              subtitle={`Invitado por ${inv.invitedBy.name}`}
              trailing={<Badge tone={badge.tone}>{badge.label}</Badge>}
              actions={
                <>
                  <Button disabled={busyId === inv.id} onClick={() => respond(inv, api.acceptInvitation)}>
                    Aceptar
                  </Button>
                  <Button variant="secondary" disabled={busyId === inv.id} onClick={() => respond(inv, api.declineInvitation)}>
                    Rechazar
                  </Button>
                </>
              }
            />
          )
        })}

        {others.map((inv) => {
          const badge = statusBadge(inv.status)
          return (
            <ListRow
              key={inv.id}
              title={inv.account.name}
              subtitle={`Invitado por ${inv.invitedBy.name}`}
              trailing={<Badge tone={badge.tone}>{badge.label}</Badge>}
            />
          )
        })}
      </div>
    </Layout>
  )
}
