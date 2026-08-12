import { useState } from 'react'
import { Plus, X, type LucideIcon } from 'lucide-react'
import './Fab.css'

export interface FabAction {
  label: string
  icon: LucideIcon
  onClick: () => void
}

export function Fab({ actions }: { actions: FabAction[] }) {
  const [open, setOpen] = useState(false)

  if (actions.length === 0) return null

  function handleAction(action: FabAction) {
    setOpen(false)
    action.onClick()
  }

  return (
    <div className="fab-root">
      {open && <div className="fab-backdrop" onClick={() => setOpen(false)} />}
      <div className={`fab-actions ${open ? 'open' : ''}`}>
        {actions.map((action, index) => (
          <button
            key={action.label}
            type="button"
            className="fab-action"
            style={{ transitionDelay: open ? `${index * 30}ms` : '0ms' }}
            onClick={() => handleAction(action)}
          >
            <span className="fab-action-label">{action.label}</span>
            <span className="fab-action-icon">
              <action.icon size={18} />
            </span>
          </button>
        ))}
      </div>
      <button
        type="button"
        className="fab-trigger"
        aria-expanded={open}
        aria-label={open ? 'Cerrar acciones rápidas' : 'Acciones rápidas'}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <X size={24} /> : <Plus size={24} />}
      </button>
    </div>
  )
}
