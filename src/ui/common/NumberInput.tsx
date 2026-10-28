/**
 * A plain number box (angles, counts) that commits on Enter or when you click away.
 * A blank or non-numeric entry is ignored and the box goes back to the current value.
 */
export function NumberInput({
  label, value, onChange, min, max, step = 1, width = 'w-20'
}: { label: string; value: number; onChange(v: number): void; min?: number; max?: number; step?: number; width?: string }) {
  return (
    <label className="flex items-center justify-between gap-2 text-xs text-stone-600">
      {label}
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        aria-label={label}
        defaultValue={value}
        key={value}
        onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        onBlur={e => {
          const text = e.target.value.trim()
          const v = Number(text)
          if (text === '' || !Number.isFinite(v)) {
            e.target.value = String(value)
            return
          }
          const clamped = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, v))
          if (clamped !== value) onChange(clamped)
          else e.target.value = String(value)
        }}
        className={`${width} rounded border border-stone-300 px-1 py-0.5 text-right text-sm`}
      />
    </label>
  )
}
