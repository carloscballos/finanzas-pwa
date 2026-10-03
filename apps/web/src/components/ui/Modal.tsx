import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import './Modal.css'

/**
 * Modal sobre el <dialog> nativo: el navegador ya resuelve Escape, el foco
 * atrapado dentro y dejar el resto de la página inerte. Aquí solo se agrega
 * cerrar al tocar el fondo, bloquear el scroll de la página y el estilo
 * (hoja inferior en celular).
 */
export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  return (
    <dialog
      ref={ref}
      className="ui-modal"
      aria-labelledby="ui-modal-title"
      onClose={onClose}
      onClick={(e) => {
        // El <dialog> es el propio fondo: un clic cuyo objetivo es él (y no
        // algo de su contenido) cayó fuera de la tarjeta.
        if (e.target === e.currentTarget) onClose()
      }}
    >
      {open && (
        <div className="ui-modal-panel">
          <div className="ui-modal-header">
            <h2 id="ui-modal-title">{title}</h2>
            <button type="button" className="ui-modal-close" onClick={onClose} aria-label="Cerrar">
              <X size={18} />
            </button>
          </div>
          <div className="ui-modal-body">{children}</div>
        </div>
      )}
    </dialog>
  )
}
