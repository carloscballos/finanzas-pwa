import { useEffect, useState } from 'react'
import { Layout } from '../components/Layout'
import { useAuth } from '../context/AuthContext'
import * as api from '../lib/api'
import { ApiError, type Invitation } from '../lib/api'
import './InvitationsPage.css'

function statusBadge(status: Invitation['status']) {
  if (status === 'ACCEPTED') return { label: 'Aceptada', className: 'badge-ok' }
  if (status === 'DECLINED') return { label: 'Rechazada', className: 'badge-error' }
  if (status === 'CANCELED') return { label: 'Cancelada', className: 'badge-neutral' }
  return { label: 'Pendiente', className: 'badge-warn' }
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
      <div className="debts-toolbar">
        <h1>Invitaciones</h1>
      </div>

      {loading && <p>Cargando…</p>}
      {error && <div className="auth-error">{error}</div>}

      {!loading && !error && invitations.length === 0 && (
        <p className="accounts-empty">No tienes invitaciones.</p>
      )}

      <div className="invitations-list">
        {pending.map((inv) => {
          const badge = statusBadge(inv.status)
          return (
            <div className="invitation-card" key={inv.id}>
              <div className="invitation-info">
                <span className="invitation-account">{inv.account.name}</span>
                <span className="invitation-from">Invitado por {inv.invitedBy.name}</span>
              </div>
              <div className="invitation-actions">
                <span className={`badge ${badge.className}`}>{badge.label}</span>
                <button
                  className="btn"
                  disabled={busyId === inv.id}
                  onClick={() => respond(inv, api.acceptInvitation)}
                >
                  Aceptar
                </button>
                <button
                  className="btn btn-secondary"
                  disabled={busyId === inv.id}
                  onClick={() => respond(inv, api.declineInvitation)}
                >
                  Rechazar
                </button>
              </div>
            </div>
          )
        })}

        {others.map((inv) => {
          const badge = statusBadge(inv.status)
          return (
            <div className="invitation-card" key={inv.id}>
              <div className="invitation-info">
                <span className="invitation-account">{inv.account.name}</span>
                <span className="invitation-from">Invitado por {inv.invitedBy.name}</span>
              </div>
              <span className={`badge ${badge.className}`}>{badge.label}</span>
            </div>
          )
        })}
      </div>
    </Layout>
  )
}
