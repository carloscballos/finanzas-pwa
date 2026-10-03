import { useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { syncPush } from '../lib/push'

/**
 * No dibuja nada. Al iniciar sesión reafirma en el backend la suscripción push
 * de este dispositivo (si ya la había activado). Va en Layout.
 */
export function PushSync() {
  const { token } = useAuth()
  useEffect(() => {
    if (token) syncPush(token).catch(() => {
      /* silencioso: es un refuerzo, no una acción del usuario */
    })
  }, [token])
  return null
}
