import { useEffect, useId, useState } from 'react'
import { formatInches, parseInches } from '../../model/units'

type Props = {
  label: string
  value: number
  onChange(value: number): void
  allowZero?: boolean
  disabled?: boolean
}

/** A size box: shows 11-3/4", accepts 11 3/4 / 11-3/4 / 11.75 / 1' 2", rejects bad input with the reason. */
export function InchInput({ label, value, onChange, allowZero, disabled }: Props) {
  const id = useId()
  const [text, setText] = useState(formatInches(value))
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    setText(formatInches(value))
    setError(null)
  }, [value])

  const commit = () => {
    const r = parseInches(text, { allowZero })
    if (!r.ok) {
      setError(r.reason)
      return
    }
    setError(null)
    if (r.value !== value) onChange(r.value)
    else setText(formatInches(value))
  }

  return (
    <div className="flex flex-col gap-0.5">
      <label htmlFor={id} className="text-xs text-stone-600">{label}</label>
      <input
        id={id}
        value={text}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        onChange={e => setText(e.target.value)}
        onBlur={() => (error ? undefined : commit())}
        onKeyDown={e => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') {
            setText(formatInches(value))
            setError(null)
          }
        }}
        className={`w-full rounded border px-2 py-1 text-sm ${error ? 'border-red-500 bg-red-50' : 'border-stone-300'} disabled:bg-stone-100`}
      />
      {error && <span role="alert" className="text-xs text-red-600">{error}</span>}
    </div>
  )
}
