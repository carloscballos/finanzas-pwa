import type { CSSProperties, HTMLAttributes } from 'react'
import './CardGrid.css'

interface CardGridProps extends HTMLAttributes<HTMLDivElement> {
  /** Minimum column width in px before wrapping to the next row. */
  minWidth?: number
}

export function CardGrid({ minWidth = 260, className = '', style, ...props }: CardGridProps) {
  return (
    <div
      className={`ui-card-grid ${className}`.trim()}
      style={{ ...style, '--ui-card-grid-min': `${minWidth}px` } as CSSProperties}
      {...props}
    />
  )
}
