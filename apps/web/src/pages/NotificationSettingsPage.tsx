import { BellRing, Share, SquarePlus } from 'lucide-react'
import { Layout } from '../components/Layout'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { SectionHeader } from '../components/ui/SectionHeader'
import { usePushNotifications, type PushStatus } from '../hooks/usePushNotifications'
import './NotificationSettingsPage.css'

// Mensajes para los estados en los que no se puede (o no hace falta) activar.
const STATUS_MESSAGES: Partial<Record<PushStatus, string>> = {
  unsupported: 'Este navegador no admite notificaciones push. Seguirás viendo los avisos en la campana de la app.',
  'no-service-worker':
    'El servicio que recibe las notificaciones solo funciona en la versión publicada de la app, no en modo desarrollo.',
  'server-disabled': 'El servidor todavía no tiene configuradas las notificaciones push.',
  blocked:
    'Bloqueaste el permiso de notificaciones. Para activarlas, habilítalo en los ajustes del dispositivo (en iPhone: Ajustes → Notificaciones → Finanzas).',
}

export function NotificationSettingsPage() {
  const { status, busy, error, enable, disable } = usePushNotifications()

  return (
    <Layout>
      <SectionHeader
        as="h1"
        title="Notificaciones"
        subtitle="Recibe avisos en este dispositivo aunque la app esté cerrada"
      />

      <div className="notif-settings">
        <Card>
          <div className="notif-settings-row">
            <span className="notif-settings-icon">
              <BellRing size={20} />
            </span>
            <div className="notif-settings-text">
              <strong>Avisos push en este dispositivo</strong>
              <small>
                Solicitudes de amistad, invitaciones a cuentas, deudas y abonos. La campana de la app
                siempre guarda el historial.
              </small>
            </div>
            {status === 'on' && <Badge tone="ok">Activadas</Badge>}
          </div>

          {status === 'loading' && <p className="notif-settings-note">Revisando este dispositivo…</p>}

          {status === 'off' && (
            <Button onClick={enable} disabled={busy}>
              {busy ? 'Activando…' : 'Activar notificaciones'}
            </Button>
          )}

          {status === 'on' && (
            <Button variant="secondary" onClick={disable} disabled={busy}>
              {busy ? 'Desactivando…' : 'Desactivar en este dispositivo'}
            </Button>
          )}

          {STATUS_MESSAGES[status] && <p className="notif-settings-note">{STATUS_MESSAGES[status]}</p>}

          {status === 'needs-install' && (
            <div className="notif-settings-install">
              <p className="notif-settings-note">
                En iPhone y iPad las notificaciones solo funcionan con la app instalada en la pantalla de inicio:
              </p>
              <ol>
                <li>
                  Abre esta página en <strong>Safari</strong> y toca <Share size={14} aria-label="Compartir" />{' '}
                  Compartir.
                </li>
                <li>
                  Elige <SquarePlus size={14} aria-hidden="true" /> <strong>Agregar a pantalla de inicio</strong>.
                </li>
                <li>Abre Finanzas desde ese ícono y vuelve a esta pantalla para activarlas.</li>
              </ol>
              <p className="notif-settings-note">Requiere iOS 16.4 o superior.</p>
            </div>
          )}

          {error && <p className="notif-settings-error">{error}</p>}
        </Card>
      </div>
    </Layout>
  )
}
