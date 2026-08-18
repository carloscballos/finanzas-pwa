import type { ReactNode } from 'react'
import './EmptyState.css'

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="ui-empty-state">{children}</p>
}
