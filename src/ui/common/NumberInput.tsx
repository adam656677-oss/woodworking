/**
 * A plain number box (angles, counts) that commits on Enter or blur.
 * Escape cancels. Blank and non-finite entries restore the current value.
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
        onKeyDown={e => {
          if (e.key !== 'Enter' && e.key !== 'Escape') return
          e.preventDefault()
          e.stopPropagation()
          if (e.key === 'Escape') e.currentTarget.value = String(value)
          e.currentTarget.blur()
        }}
        onBlur={e => {
          const text = e.target.value.trim()
          const v = Number(text)
          if (text === '' || !Number.isFinite(v)) {
            e.target.value = String(value)
            return
          }
          const clamped = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, v))
          e.target.value = String(clamped)
          if (clamped !== value) onChange(clamped)
        }}
        className={`${width} rounded border border-stone-300 px-1 py-0.5 text-right text-sm`}
      />
    </label>
  )
}
