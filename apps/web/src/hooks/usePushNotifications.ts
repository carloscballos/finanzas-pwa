import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import * as api from '../lib/api'
import * as push from '../lib/push'

export type PushStatus =
  | 'loading'
  | 'unsupported' // el navegador no tiene Web Push
  | 'needs-install' // iOS: hay que agregar la app a la pantalla de inicio
  | 'no-service-worker' // `vite dev`: el SW solo existe en el build
  | 'server-disabled' // el backend no tiene claves VAPID
  | 'blocked' // el usuario negó el permiso
  | 'off'
  | 'on'

/** Estado y acciones de push de ESTE dispositivo. */
export function usePushNotifications() {
  const { token } = useAuth()
  const [status, setStatus] = useState<PushStatus>('loading')
  const [publicKey, setPublicKey] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!token) return
    const support = push.getPushSupport()
    if (support !== 'supported') return setStatus(support)
    if (!(await push.hasServiceWorker())) return setStatus('no-service-worker')

    try {
      const config = await api.getPushConfig(token)
      if (!config.enabled || !config.publicKey) return setStatus('server-disabled')
      setPublicKey(config.publicKey)
    } catch {
      return setStatus('server-disabled')
    }

    if (Notification.permission === 'denied') return setStatus('blocked')
    const subscription = await push.getCurrentSubscription()
    setStatus(Notification.permission === 'granted' && subscription ? 'on' : 'off')
  }, [token])

  useEffect(() => {
    refresh()
  }, [refresh])

  const run = useCallback(
    async (action: () => Promise<void>) => {
      setBusy(true)
      setError(null)
      try {
        await action()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo completar la acción')
      } finally {
        await refresh()
        setBusy(false)
      }
    },
    [refresh],
  )

  const enable = useCallback(
    () => run(async () => {
      if (!token || !publicKey) return
      await push.enablePush(token, publicKey)
    }),
    [run, token, publicKey],
  )

  const disable = useCallback(
    () => run(async () => {
      if (token) await push.disablePush(token)
    }),
    [run, token],
  )

  return { status, busy, error, enable, disable }
}
