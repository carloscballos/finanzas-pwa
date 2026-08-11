import { useEffect, useState, type FormEvent } from 'react'
import { Layout } from '../components/Layout'
import { UserAutocomplete } from '../components/UserAutocomplete'
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
      <div className="debts-toolbar">
        <h1>Amigos</h1>
      </div>

      <form className="create-form" onSubmit={handleSend}>
        {sendError && (
          <div className="auth-error field-full" style={{ margin: 0 }}>
            {sendError}
          </div>
        )}
        <div className="field field-full">
          <label htmlFor="friend-email">Agregar amigo por email</label>
          <UserAutocomplete
            id="friend-email"
            value={email}
            onChange={setEmail}
            placeholder="alguien@example.com"
          />
        </div>
        <button className="btn" type="submit" disabled={sending}>
          {sending ? 'Enviando…' : 'Enviar solicitud'}
        </button>
      </form>

      {loading && <p>Cargando…</p>}
      {error && <div className="auth-error">{error}</div>}

      {!loading && !error && (
        <>
          {received.length > 0 && (
            <section className="friends-section">
              <h2>Solicitudes recibidas</h2>
              <div className="invitations-list">
                {received.map((r) => (
                  <div className="invitation-card" key={r.id}>
                    <div className="invitation-info">
                      <span className="invitation-account">{r.requestedBy.name}</span>
                      <span className="invitation-from">{r.requestedBy.email}</span>
                    </div>
                    <div className="invitation-actions">
                      <button className="btn" disabled={busyId === r.id} onClick={() => handleAccept(r)}>
                        Aceptar
                      </button>
                      <button
                        className="btn btn-secondary"
                        disabled={busyId === r.id}
                        onClick={() => handleDecline(r)}
                      >
                        Rechazar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {sent.length > 0 && (
            <section className="friends-section">
              <h2>Solicitudes enviadas</h2>
              <div className="invitations-list">
                {sent.map((r) => (
                  <div className="invitation-card" key={r.id}>
                    <div className="invitation-info">
                      <span className="invitation-account">{r.requestedTo.name}</span>
                      <span className="invitation-from">{r.requestedTo.email}</span>
                    </div>
                    <div className="invitation-actions">
                      <span className="badge badge-warn">Pendiente</span>
                      <button
                        className="link-danger"
                        disabled={busyId === r.id}
                        onClick={() => handleCancel(r)}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="friends-section">
            <h2>Mis amigos</h2>
            {friends.length === 0 ? (
              <p className="accounts-empty">Todavía no tienes amigos agregados.</p>
            ) : (
              <div className="invitations-list">
                {friends.map((f) => (
                  <div className="invitation-card" key={f.id}>
                    <div className="invitation-info">
                      <span className="invitation-account">{f.name}</span>
                      <span className="invitation-from">{f.email}</span>
                    </div>
                    <button className="link-danger" onClick={() => handleRemove(f)}>
                      Quitar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </Layout>
  )
}
