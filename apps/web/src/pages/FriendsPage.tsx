import { useEffect, useState, type FormEvent } from 'react'
import { Layout } from '../components/Layout'
import { UserAutocomplete } from '../components/UserAutocomplete'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { Form, FormField, FormError } from '../components/ui/Form'
import { ListRow } from '../components/ui/ListRow'
import { SectionHeader } from '../components/ui/SectionHeader'
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

  return (
    <Layout>
      <SectionHeader as="h1" title="Amigos" />

      <Card className="ui-form-card">
        <Form onSubmit={handleSend}>
          <FormError>{sendError}</FormError>
          <FormField label="Agregar amigo por email" htmlFor="friend-email" full>
            <UserAutocomplete id="friend-email" value={email} onChange={setEmail} placeholder="alguien@example.com" />
          </FormField>
          <Button type="submit" disabled={sending}>
            {sending ? 'Enviando…' : 'Enviar solicitud'}
          </Button>
        </Form>
      </Card>

      {loading && <p>Cargando…</p>}
      {error && <div className="auth-error">{error}</div>}

      {!loading && !error && (
        <>
          {received.length > 0 && (
            <section className="friends-section">
              <SectionHeader title="Solicitudes recibidas" />
              <div className="friends-list">
                {received.map((r) => (
                  <ListRow
                    key={r.id}
                    title={r.requestedBy.name}
                    subtitle={r.requestedBy.email}
                    actions={
                      <>
                        <Button disabled={busyId === r.id} onClick={() => handleAccept(r)}>
                          Aceptar
                        </Button>
                        <Button variant="secondary" disabled={busyId === r.id} onClick={() => handleDecline(r)}>
                          Rechazar
                        </Button>
                      </>
                    }
                  />
                ))}
              </div>
            </section>
          )}

          {sent.length > 0 && (
            <section className="friends-section">
              <SectionHeader title="Solicitudes enviadas" />
              <div className="friends-list">
                {sent.map((r) => (
                  <ListRow
                    key={r.id}
                    title={r.requestedTo.name}
                    subtitle={r.requestedTo.email}
                    actions={
                      <>
                        <Badge tone="warn">Pendiente</Badge>
                        <button className="link-danger" disabled={busyId === r.id} onClick={() => handleCancel(r)}>
                          Cancelar
                        </button>
                      </>
                    }
                  />
                ))}
              </div>
            </section>
          )}

          <section className="friends-section">
            <SectionHeader title="Mis amigos" />
            {friends.length === 0 ? (
              <EmptyState>Todavía no tienes amigos agregados.</EmptyState>
            ) : (
              <div className="friends-list">
                {friends.map((f) => (
                  <ListRow
                    key={f.id}
                    title={f.name}
                    subtitle={f.email}
                    actions={
                      <button className="link-danger" onClick={() => handleRemove(f)}>
                        Quitar
                      </button>
                    }
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </Layout>
  )
}
