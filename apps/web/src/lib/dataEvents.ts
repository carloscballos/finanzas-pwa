// Aviso simple entre partes de la app: algo que muestran las pantallas
// (saldos, gastado de un presupuesto) cambió desde afuera de ellas — por
// ejemplo, el botón global de "Nuevo movimiento" del Layout. La pantalla
// visible se suscribe y se vuelve a cargar sin recargar la página.
const EVENT = 'finanzas:data-changed'

export function emitDataChanged() {
  window.dispatchEvent(new Event(EVENT))
}

export function onDataChanged(callback: () => void): () => void {
  window.addEventListener(EVENT, callback)
  return () => window.removeEventListener(EVENT, callback)
}
