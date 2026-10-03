import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Plus } from 'lucide-react'
import { ProgressBar, type ProgressTone } from './ProgressBar'
import './HomeRow.css'

/** Sección del Home: título con enlace a la página completa y una fila horizontal de tarjetas. */
export function HomeRow({
  title,
  to,
  summary,
  children,
}: {
  title: string
  to: string
  summary?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="home-row">
      <div className="home-row-header">
        <Link to={to} className="home-row-title">
          {title}
          <ChevronRight size={18} aria-hidden="true" />
        </Link>
        {summary && <div className="home-row-summary">{summary}</div>}
      </div>
      <div className="home-row-track">{children}</div>
    </section>
  )
}

/** Tarjeta de una fila del Home: misma anatomía que StatCard, pero navegable y con barra opcional. */
export function TileCard({
  to,
  label,
  value,
  sub,
  badge,
  progress,
}: {
  to: string
  label: ReactNode
  value: ReactNode
  sub?: ReactNode
  badge?: ReactNode
  progress?: { value: number; tone?: ProgressTone }
}) {
  return (
    <Link to={to} className="card home-tile">
      <div className="home-tile-label">
        <span>{label}</span>
        {badge}
      </div>
      <div className="home-tile-value">{value}</div>
      {sub && <div className="home-tile-sub">{sub}</div>}
      {progress && (
        <div className="home-tile-progress">
          <ProgressBar value={progress.value} tone={progress.tone} height={6} />
        </div>
      )}
    </Link>
  )
}

/** Última tarjeta de la fila: atajo para crear (reemplaza a los accesos rápidos). Con `onClick` abre un modal; con `to`, navega. */
export function AddTile({ to, onClick, label }: { to?: string; onClick?: () => void; label: string }) {
  const content = (
    <>
      <Plus size={18} aria-hidden="true" />
      <span>{label}</span>
    </>
  )
  if (onClick) {
    return (
      <button type="button" className="home-tile home-tile-add" onClick={onClick}>
        {content}
      </button>
    )
  }
  return (
    <Link to={to ?? '/'} className="home-tile home-tile-add">
      {content}
    </Link>
  )
}
