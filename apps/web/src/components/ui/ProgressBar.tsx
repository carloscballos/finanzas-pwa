import './ProgressBar.css'

export type ProgressTone = 'accent' | 'ok' | 'warn' | 'error'

export function ProgressBar({
  value,
  tone = 'accent',
  height = 10,
}: {
  value: number
  tone?: ProgressTone
  height?: number
}) {
  const clamped = Math.max(0, Math.min(100, value))
  return (
    <div className="ui-progress-track" style={{ height }}>
      <div className={`ui-progress-fill ui-progress-fill-${tone}`} style={{ width: `${clamped}%` }} />
    </div>
  )
}
