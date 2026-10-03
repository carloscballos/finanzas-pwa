import type { ReactNode } from 'react'
import { Card } from './Card'
import { ProgressBar, type ProgressTone } from './ProgressBar'
import './SummaryCard.css'

/** Contenedor de las tarjetas de resumen que van arriba de una lista (Presupuestos, Metas). */
export function SummaryGrid({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="ui-summary-grid" aria-label={label}>
      {children}
    </section>
  )
}

/** Resumen de un grupo: etiqueta, cifra principal, barra opcional y una línea al pie. */
export function SummaryCard({
  label,
  main,
  progress,
  footLeft,
  footRight,
}: {
  label: ReactNode
  main: ReactNode
  progress?: { value: number; tone?: ProgressTone }
  footLeft?: ReactNode
  footRight?: ReactNode
}) {
  return (
    <Card className="ui-summary-card">
      <div className="ui-summary-label">{label}</div>
      <div className="ui-summary-main">{main}</div>
      {progress && <ProgressBar value={progress.value} tone={progress.tone} height={10} />}
      {(footLeft || footRight) && (
        <div className="ui-summary-foot">
          <span>{footLeft}</span>
          {footRight && <span className="ui-summary-foot-right">{footRight}</span>}
        </div>
      )}
    </Card>
  )
}
