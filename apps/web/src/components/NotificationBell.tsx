import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, CheckCheck, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import * as api from '../lib/api'
import { onDataChanged } from '../lib/dataEvents'
import './NotificationBell.css'

// Los avisos los crea el backend cuando OTRA persona hace algo que te toca
// (solicitud, invitación, deuda, abono). No hay conexión en vivo: se vuelve a
// pedir cada minuto, al volver a la pestaña y tras cualquier cambio de datos
// hecho desde aquí. Cuando haya push (Web Push), esto sigue siendo el listado.
const POLL_MS = 60_000

function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  if (seconds < 60) return 'ahora'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.round(hours / 24)
  return days === 1 ? 'ayer' : `hace ${days} días`
}

export function NotificationBell({ placement = 'down-right' }: { placement?: 'down-right' | 'down-left' }) {
  const { token } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState<api.NotificationsList>({ items: [], unreadCount: 0 })
  const [open, setOpen] = useState(false)
  const [failed, setFailed] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const load = useCallback(() => {
    if (!token) return
    api
      .getNotifications(token)
      .then((list) => {
        setData(list)
        setFailed(false)
      })
      // Un fallo puntual no debe molestar: se conserva lo último que se vio.
      .catch(() => setFailed(true))
  }, [token])

  useEffect(() => {
    load()
    const interval = window.setInterval(load, POLL_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') load()
    }
    document.addEventListener('visibilitychange', onVisible)
    const offData = onDataChanged(load)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
      offData()
    }
  }, [load])

  useEffect(() => {
    if (!open) return
    function handleClickOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false)
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  function handleOpen(notification: api.AppNotification) {
    setOpen(false)
    if (!notification.read && token) {
      setData((d) => ({
        items: d.items.map((n) => (n.id === notification.id ? { ...n, read: true } : n)),
        unreadCount: Math.max(0, d.unreadCount - 1),
      }))
      api.markNotificationRead(token, notification.id).catch(load)
    }
    if (notification.link) navigate(notification.link)
  }

  function handleDismiss(notification: api.AppNotification) {
    if (!token) return
    setData((d) => ({
      items: d.items.filter((n) => n.id !== notification.id),
      unreadCount: notification.read ? d.unreadCount : Math.max(0, d.unreadCount - 1),
    }))
    api.deleteNotification(token, notification.id).catch(load)
  }

  function handleReadAll() {
    if (!token) return
    setData((d) => ({ items: d.items.map((n) => ({ ...n, read: true })), unreadCount: 0 }))
    api.markAllNotificationsRead(token).catch(load)
  }

  const { items, unreadCount } = data
  const label = unreadCount > 0 ? `Notificaciones (${unreadCount} sin leer)` : 'Notificaciones'

  return (
    <div className="notif-bell" ref={rootRef}>
      <button
        type="button"
        className="notif-bell-trigger"
        onClick={() => {
          setOpen((v) => !v)
          if (!open) load()
        }}
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Notificaciones"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="notif-bell-badge" aria-hidden="true">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className={`notif-panel notif-panel-${placement}`} role="dialog" aria-label="Notificaciones">
          <div className="notif-panel-head">
            <strong>Notificaciones</strong>
            {unreadCount > 0 && (
              <button type="button" className="notif-panel-readall" onClick={handleReadAll}>
                <CheckCheck size={14} /> Marcar todas
              </button>
            )}
          </div>

          {failed && items.length === 0 ? (
            <p className="notif-empty">No se pudieron cargar. Reintenta en un momento.</p>
          ) : items.length === 0 ? (
            <p className="notif-empty">Estás al día. Aquí verás solicitudes, invitaciones, deudas y abonos.</p>
          ) : (
            <ul className="notif-list">
              {items.map((n) => (
                <li key={n.id} className={`notif-item ${n.read ? '' : 'unread'}`}>
                  <button type="button" className="notif-item-main" onClick={() => handleOpen(n)}>
                    <span className="notif-item-dot" aria-hidden="true" />
                    <span className="notif-item-text">
                      <span className="notif-item-title">{n.title}</span>
                      {n.body && <span className="notif-item-body">{n.body}</span>}
                      <span className="notif-item-time">{timeAgo(n.createdAt)}</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="notif-item-dismiss"
                    onClick={() => handleDismiss(n)}
                    aria-label="Descartar notificación"
                    title="Descartar"
                  >
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
