import { useEffect, useId, useState } from 'react'
import { formatInches, parseInches } from '../../model/units'
import { parseFormula } from '../expr'

export type FormulaSet = { formula: string } | { value: number }
type Props = {
  label: string
  value: number
  formula?: string
  error?: string
  ruleNote?: string
  allowZero?: boolean
  disabled?: boolean
  onSet(v: FormulaSet): void
}
const display = (value: number) => formatInches(value, { sixtyFourths: true })

/** Focus reveals the formula; replacing a formula or placement rule requires confirmation. */
export function FormulaInput({ label, value, formula, error, ruleNote, allowZero, disabled, onSet }: Props) {
  const id = useId()
  const errorId = `${id}-error`
  const shown = () => (formula ? `=${formula}` : display(value))
  const [text, setText] = useState(() => display(value))
  const [focused, setFocused] = useState(false)
  const [local, setLocal] = useState<string | null>(null)
  const [asking, setAsking] = useState<number | null>(null)
  useEffect(() => { if (!focused) setText(display(value)) }, [value, focused])

  const commit = () => {
    if (disabled) return
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
        type="text"
        value={text}
        disabled={disabled}
        spellCheck={false}
        autoComplete="off"
        title={formula ? `=${formula}` : ruleNote}
        aria-invalid={message ? true : undefined}
        aria-describedby={message ? errorId : undefined}
        onFocus={() => { setFocused(true); setText(shown()) }}
        onChange={e => { setText(e.target.value); setLocal(null) }}
        onBlur={() => { setFocused(false); if (!local && asking === null) commit() }}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); commit() }
          if (e.key === 'Escape') {
            e.preventDefault()
            e.stopPropagation()
            setText(shown())
            setLocal(null)
            setAsking(null)
          }
        }}
        className={`w-full rounded border px-2 py-1 text-sm tabular-nums focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 ${message ? 'border-red-500 bg-red-50' : formula ? 'border-amber-400' : 'border-stone-300'} disabled:bg-stone-100`}
      />
      {message && <span id={errorId} role="alert" className="text-xs text-red-600">{message}</span>}
      {asking !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/20">
          <div role="dialog" aria-label="Replace" className="flex w-80 flex-col gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm shadow-xl">
            <span>{formula ? `Replace the formula =${formula} with ${display(asking)}?` : `${ruleNote} Remove the rule and move it?`}</span>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => { setAsking(null); setText(shown()) }} className="rounded px-3 py-1 hover:bg-amber-100">{formula ? 'Keep formula' : 'Keep the rule'}</button>
              <button type="button" onClick={() => { const v = asking; setAsking(null); onSet({ value: v }) }} className="rounded bg-amber-700 px-3 py-1 font-semibold text-white">{formula ? 'Replace' : 'Remove the rule'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
