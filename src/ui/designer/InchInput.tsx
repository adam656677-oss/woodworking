import { useEffect, useId, useState } from 'react'
import { formatInches, parseInches } from '../../model/units'

type Props = {
  label: string
  value: number
  onChange(value: number): void
  allowZero?: boolean
  disabled?: boolean
}

const display = (value: number) => formatInches(value, { sixtyFourths: true })

/** An inch field with fractional display, explicit validation, and keyboard cancellation. */
export function InchInput({ label, value, onChange, allowZero, disabled }: Props) {
  const id = useId()
  const errorId = `${id}-error`
  const [text, setText] = useState(() => display(value))
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    setText(display(value))
    setError(null)
  }, [value])

  const commit = () => {
    if (disabled) return
    const result = parseInches(text, { allowZero })
    if (!result.ok) {
      setError(result.reason)
      return
    }
    setError(null)
    if (result.value !== value) onChange(result.value)
    else setText(display(value))
  }

  return (
    <div className="flex flex-col gap-0.5">
      <label htmlFor={id} className="text-xs text-stone-600">{label}</label>
      <input
        id={id}
        type="text"
        value={text}
        disabled={disabled}
        spellCheck={false}
        autoComplete="off"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={e => { setText(e.target.value); setError(null) }}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault()
            e.stopPropagation()
            commit()
          }
          if (e.key === 'Escape') {
            e.preventDefault()
            e.stopPropagation()
            setText(display(value))
            setError(null)
          }
        }}
        className={`w-full rounded border px-2 py-1 text-sm tabular-nums focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 ${error ? 'border-red-500 bg-red-50' : 'border-stone-300'} disabled:bg-stone-100`}
      />
      {error && <span id={errorId} role="alert" className="text-xs text-red-600">{error}</span>}
    </div>
  )
}
