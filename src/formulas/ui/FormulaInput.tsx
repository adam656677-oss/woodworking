import { useEffect, useId, useState } from 'react'
import { formatInches, parseInches } from '../../model/units'
import { parseFormula } from '../expr'

export type FormulaSet = { formula: string } | { value: number }

type Props = {
  label: string
  value: number
  /** The formula in this box (without =), if it has one. */
  formula?: string
  /** A formula problem from the last recalculation. */
  error?: string
  /** When a layout rule places this value: typing a number asks to remove it. */
  ruleNote?: string
  allowZero?: boolean
  disabled?: boolean
  /** A new formula, or a plain value (which also clears the formula / rule). */
  onSet(v: FormulaSet): void
}

/**
 * A size box that also takes formulas: type =H - 2*T. Shows the result with ƒ; focus shows the formula.
 * Typing a plain size over a formula (or a rule) asks first.
 */
export function FormulaInput({ label, value, formula, error, ruleNote, allowZero, disabled, onSet }: Props) {
  const id = useId()
  const shown = () => (formula ? `=${formula}` : formatInches(value))
  const [text, setText] = useState(formatInches(value))
  const [focused, setFocused] = useState(false)
  const [local, setLocal] = useState<string | null>(null)
  const [asking, setAsking] = useState<number | null>(null)
  useEffect(() => { if (!focused) setText(formatInches(value)) }, [value, focused])

  const commit = () => {
    const t = text.trim()
    if (t.startsWith('=')) {
      const r = parseFormula(t)
      if (!r.ok) { setLocal(r.error); return }
      setLocal(null)
      if (t.slice(1).trim() !== formula) onSet({ formula: t.slice(1).trim() })
      return
    }
    const r = parseInches(t, { allowZero })
    if (!r.ok) { setLocal(r.reason); return }
    setLocal(null)
    if (formula || ruleNote) { setAsking(r.value); return }
    if (r.value !== value) onSet({ value: r.value })
  }

  const message = local ?? error
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1 text-xs text-stone-600">
        <label htmlFor={id}>{label}</label>
        {formula && <span title={`=${formula}`} className="font-serif italic text-amber-700" aria-label="has a formula">ƒ</span>}
        {ruleNote && !formula && <span title={ruleNote} className="text-amber-700" aria-label="placed by a rule">⚓</span>}
      </div>
      <input
        id={id}
        value={text}
        disabled={disabled}
        title={formula ? `=${formula}` : ruleNote}
        aria-invalid={message ? true : undefined}
        onFocus={() => { setFocused(true); setText(shown()) }}
        onChange={e => { setText(e.target.value); setLocal(null) }}
        onBlur={() => { setFocused(false); if (!local && asking === null) commit() }}
        onKeyDown={e => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') { setText(shown()); setLocal(null); setAsking(null) }
        }}
        className={`w-full rounded border px-2 py-1 text-sm ${message ? 'border-red-500 bg-red-50' : formula ? 'border-amber-400' : 'border-stone-300'} disabled:bg-stone-100`}
      />
      {message && <span role="alert" className="text-xs text-red-600">{message}</span>}
      {asking !== null && (
        <div role="dialog" aria-label="Replace" className="mt-1 flex flex-col gap-1 rounded border border-amber-300 bg-amber-50 p-2 text-xs">
          <span>{formula ? `Replace the formula =${formula} with ${formatInches(asking)}?` : `${ruleNote} Remove the rule and move it?`}</span>
          <div className="flex gap-1">
            <button onClick={() => { const v = asking; setAsking(null); onSet({ value: v }) }} className="rounded bg-amber-700 px-2 py-0.5 font-semibold text-white">{formula ? 'Replace' : 'Remove the rule'}</button>
            <button onClick={() => { setAsking(null); setText(shown()) }} className="rounded px-2 py-0.5 hover:bg-amber-100">{formula ? 'Keep formula' : 'Keep the rule'}</button>
          </div>
        </div>
      )}
    </div>
  )
}
