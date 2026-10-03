import { useEffect, useState, type FormEvent } from 'react'
import { Trash2, UserPlus } from 'lucide-react'
import { Layout } from '../components/Layout'
import { UserAutocomplete } from '../components/UserAutocomplete'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { Form, FormField, FormError } from '../components/ui/Form'
import { IconChip } from '../components/ui/IconChip'
import { ListRow } from '../components/ui/ListRow'
import { Modal } from '../components/ui/Modal'
import { SectionHeader } from '../components/ui/SectionHeader'
import { useCreateFormToggle } from '../components/ui/useCreateFormToggle'
import { useAuth } from '../context/AuthContext'
import * as api from '../lib/api'
import { ApiError, type Friend, type FriendRequest } from '../lib/api'
import './FriendsPage.css'

export function FriendsPage() {
  const { token } = useAuth()
  const [friends, setFriends] = useState<Friend[]>([])
  const [received, setReceived] = useState<FriendRequest[]>([])
  const [sent, setSent] = useState<FriendRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const { open: showForm, toggle: toggleForm, close: closeForm } = useCreateFormToggle()
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  function loadAll() {
    if (!token) return
    Promise.all([api.getFriends(token), api.getReceivedFriendRequests(token), api.getSentFriendRequests(token)])
      .then(([f, r, s]) => {
        setFriends(f)
        setReceived(r)
        setSent(s)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Error al cargar amigos'))
      .finally(() => setLoading(false))
  }

  useEffect(loadAll, [token])

  async function handleSend(event: FormEvent) {
    event.preventDefault()
    if (!token) return
    setSendError(null)
    setSending(true)
    try {
      const request = await api.sendFriendRequest(token, email)
      setSent((prev) => [request, ...prev])
      setEmail('')
      closeForm()
    } catch (err) {
      setSendError(err instanceof ApiError ? err.message : 'No se pudo enviar la solicitud')
    } finally {
      setSending(false)
    }
  }

  async function handleAccept(request: FriendRequest) {
    if (!token) return
    setBusyId(request.id)
    try {
      await api.acceptFriendRequest(token, request.id)
      setReceived((prev) => prev.filter((r) => r.id !== request.id))
      setFriends(await api.getFriends(token))
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'No se pudo aceptar la solicitud')
    } finally {
      setBusyId(null)
    }
  }

  async function handleDecline(request: FriendRequest) {
    if (!token) return
    setBusyId(request.id)
    try {
      await api.declineFriendRequest(token, request.id)
      setReceived((prev) => prev.filter((r) => r.id !== request.id))
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'No se pudo rechazar la solicitud')
    } finally {
      setBusyId(null)
    }
  }

  async function handleCancel(request: FriendRequest) {
    if (!token) return
    setBusyId(request.id)
    try {
      await api.cancelFriendRequest(token, request.id)
      setSent((prev) => prev.filter((r) => r.id !== request.id))
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'No se pudo cancelar la solicitud')
    } finally {
      setBusyId(null)
    }
  }

  async function handleRemove(friend: Friend) {
    if (!token) return
    if (!confirm(`¿Dejar de ser amigo de ${friend.name}?`)) return
    try {
      await api.removeFriend(token, friend.id)
      setFriends((prev) => prev.filter((f) => f.id !== friend.id))
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'No se pudo completar la acción')
    }
  }

  const initial = (name: string) => name.trim().charAt(0).toUpperCase() || '?'

  return (
    <Layout fabActions={[{ label: 'Agregar amigo', icon: UserPlus, onClick: toggleForm }]}>
      <SectionHeader
        as="h1"
        title="Amigos"
        subtitle="Aparecen primero al buscar personas para deudas e invitaciones. Ser amigo no da acceso a tus datos."
      >
        <Button className="toolbar-create-btn" onClick={toggleForm}>
          + Agregar amigo
        </Button>
      </SectionHeader>

      <Modal open={showForm} onClose={closeForm} title="Agregar amigo">
        <Form onSubmit={handleSend}>
          <FormError>{sendError}</FormError>
          <FormField label="Email o nombre" htmlFor="friend-email" full>
            <UserAutocomplete id="friend-email" value={email} onChange={setEmail} placeholder="alguien@example.com" />
          </FormField>
          <Button type="submit" disabled={sending}>
            {sending ? 'Enviando…' : 'Enviar solicitud'}
          </Button>
        </Form>
      </Modal>

      {loading && <p>Cargando…</p>}
      {error && <div className="auth-error">{error}</div>}

      {!loading && !error && (
        <>
          {received.length > 0 && (
            <section className="friends-received" aria-label="Solicitudes recibidas">
              <h2>Solicitudes recibidas ({received.length})</h2>
              <div className="friends-list">
                {received.map((r) => (
                  <Card key={r.id} className="friends-received-card">
                    <div className="friends-person">
                      <IconChip>{initial(r.requestedBy.name)}</IconChip>
                      <div>
                        <strong>{r.requestedBy.name}</strong>
                        <div className="friends-email">{r.requestedBy.email}</div>
                      </div>
                    </div>
                    <div className="friends-actions">
                      <Button disabled={busyId === r.id} onClick={() => handleAccept(r)}>
                        Aceptar
                      </Button>
                      <Button variant="secondary" disabled={busyId === r.id} onClick={() => handleDecline(r)}>
                        Rechazar
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          )}

          <section className="friends-section">
            <SectionHeader title={`Mis amigos (${friends.length})`} />
            {friends.length === 0 ? (
              <EmptyState>Todavía no tienes amigos agregados. Usa «+ Agregar amigo» para enviar una solicitud.</EmptyState>
            ) : (
              <div className="friends-list">
                {friends.map((f) => (
                  <ListRow
                    key={f.id}
                    leading={<IconChip>{initial(f.name)}</IconChip>}
                    title={f.name}
                    subtitle={f.email}
                    actions={
                      <button
                        type="button"
                        className="icon-danger-btn"
                        title="Quitar amigo"
                        aria-label={`Quitar a ${f.name}`}
                        onClick={() => handleRemove(f)}
                      >
                        <Trash2 size={16} />
                      </button>
                    }
                  />
                ))}
              </div>
            )}
          </section>

          {sent.length > 0 && (
            <section className="friends-section">
              <SectionHeader title={`Solicitudes enviadas (${sent.length})`} />
              <div className="friends-list">
                {sent.map((r) => (
                  <ListRow
                    key={r.id}
                    leading={<IconChip tone="neutral">{initial(r.requestedTo.name)}</IconChip>}
                    title={r.requestedTo.name}
                    subtitle={r.requestedTo.email}
                    trailing={<Badge tone="warn">Pendiente</Badge>}
                    actions={
                      <button type="button" className="link-danger" disabled={busyId === r.id} onClick={() => handleCancel(r)}>
                        Cancelar
                      </button>
                    }
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </Layout>
  )
}
