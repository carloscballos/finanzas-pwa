// Manejo de Web Push dentro del service worker. Lo carga el SW que genera
// vite-plugin-pwa (workbox.importScripts en vite.config.ts), así que el
// precaché y las actualizaciones siguen siendo los de siempre.
//
// Es JS plano a propósito: se sirve tal cual desde /push-sw.js, sin pasar por
// el empaquetador. Mantenerlo corto y sin dependencias.

// Contrato del payload (lo arma PushService en el backend):
//   { title: string, body?: string, url?: string, tag?: string }
self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = { title: event.data ? event.data.text() : '' }
  }

  // Safari/iOS exige mostrar SIEMPRE una notificación por cada push recibido
  // (userVisibleOnly): si no se muestra, revoca la suscripción.
  event.waitUntil(
    self.registration.showNotification(payload.title || 'Finanzas', {
      body: payload.body || undefined,
      tag: payload.tag || undefined,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      data: { url: payload.url || '/' },
    }),
  )
})

// Al tocar el aviso: enfocar la app si ya está abierta y llevarla a la ruta;
// si no, abrirla.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of windows) {
        if (new URL(client.url).origin !== self.location.origin) continue
        await client.focus()
        // navigate() no existe en todos los navegadores: si falla, abrimos ventana.
        if ('navigate' in client) {
          try {
            await client.navigate(url)
            return
          } catch {
            /* cae a openWindow */
          }
        }
      }
      await self.clients.openWindow(url)
    })(),
  )
})
