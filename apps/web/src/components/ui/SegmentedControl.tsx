import './SegmentedControl.css'

export interface SegmentedOption<T extends string> {
  value: T
  label: string
  tone?: 'ok' | 'error'
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (value: T) => void
  options: SegmentedOption<T>[]
}) {
  return (
    <div className="ui-segmented">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`ui-segmented-btn ${value === opt.value ? `active active-${opt.tone ?? 'accent'}` : ''}`.trim()}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
