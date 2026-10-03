import * as api from './api'

// Capa fina sobre las APIs del navegador para Web Push. No tiene estado de
// React (eso vive en hooks/usePushNotifications.ts) ni sabe de pantallas.

export type PushSupport = 'supported' | 'needs-install' | 'unsupported'

function isIOS(): boolean {
  // iPadOS 13+ se presenta como Mac: se distingue por la pantalla táctil.
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

/**
 * En iOS el push solo existe para la PWA instalada en la pantalla de inicio
 * (16.4+): en Safari normal `PushManager` ni siquiera está definido, y la
 * solución es instalarla, no "este navegador no sirve".
 */
export function getPushSupport(): PushSupport {
  if (!('serviceWorker' in navigator) || !('Notification' in window)) {
    return isIOS() && !isStandalone() ? 'needs-install' : 'unsupported'
  }
  if (!('PushManager' in window)) {
    return isIOS() && !isStandalone() ? 'needs-install' : 'unsupported'
  }
  return 'supported'
}

/** El service worker solo existe en el build (no en `vite dev`). */
async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  return (await navigator.serviceWorker.getRegistration()) ?? null
}

export async function hasServiceWorker(): Promise<boolean> {
  return (await getRegistration()) !== null
}

export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  const registration = await getRegistration()
  return registration ? registration.pushManager.getSubscription() : null
}

// applicationServerKey llega en base64url; el navegador la quiere en bytes.
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded)
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

// toJSON() también trae `expirationTime` y todo es opcional en su tipo: se
// arma a mano solo lo que el backend necesita.
function toInput(subscription: PushSubscription): api.PushSubscriptionInput {
  const { endpoint, keys } = subscription.toJSON()
  if (!endpoint || !keys?.p256dh || !keys.auth) throw new Error('La suscripción del navegador está incompleta.')
  return { endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } }
}

/**
 * Pide permiso (debe llamarse desde un toque del usuario: iOS lo exige),
 * suscribe este dispositivo y lo registra en el backend.
 * Lanza con un mensaje legible si algo no se puede.
 */
export async function enablePush(token: string, publicKey: string): Promise<void> {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error(
      permission === 'denied'
        ? 'El permiso está bloqueado. Actívalo en los ajustes del dispositivo para esta app.'
        : 'No se concedió el permiso de notificaciones.',
    )
  }

  const registration = await getRegistration()
  if (!registration) throw new Error('El service worker no está activo en este modo.')

  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    }))

  await api.subscribePush(token, toInput(subscription))
}

/** Da de baja este dispositivo (navegador y backend). */
export async function disablePush(token: string): Promise<void> {
  const subscription = await getCurrentSubscription()
  if (!subscription) return
  // Primero el backend: si falla, la suscripción local sigue y se puede reintentar.
  await api.unsubscribePush(token, subscription.endpoint)
  await subscription.unsubscribe()
}

/**
 * Si este dispositivo ya está suscrito, reafirma el registro en el backend
 * (idempotente). Cubre cambiar de cuenta en el mismo navegador y suscripciones
 * que el backend borró. No pide permisos ni suscribe nada nuevo.
 */
export async function syncPush(token: string): Promise<void> {
  if (getPushSupport() !== 'supported' || Notification.permission !== 'granted') return
  const subscription = await getCurrentSubscription()
  if (subscription) await api.subscribePush(token, toInput(subscription))
}
