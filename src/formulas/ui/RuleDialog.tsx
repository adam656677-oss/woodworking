// Layout rules on a part: the list, and a small form to add one.
import { useState } from 'react'
import type { Board, Project } from '../../model/types'
import { parseInches } from '../../model/units'
import { studio, useStudio } from '../../ui/store'
import { partNameOf } from '../recalc'
import { addRule, removeRule, ruleLabel, rulesOn } from '../rules'
import type { Axis3, NewRule, RuleKind } from '../types'

const AXES: [Axis3, string][] = [['x', 'Across (X)'], ['y', 'Front to back (Y)'], ['z', 'Up (Z)']]
const KINDS: [RuleKind, string][] = [['spacing', 'Equal spacing'], ['center', 'Centered'], ['gap', 'Fixed gap / flush'], ['count', 'Count from a formula']]

function PartSelect({ p, label, value, onChange, not }: { p: Project; label: string; value: string; onChange(v: string): void; not: string[] }) {
  return (
    <label className="flex flex-col text-xs text-stone-600">{label}
      <select aria-label={label} value={value} onChange={e => onChange(e.target.value)} className="rounded border border-stone-300 px-1 py-1 text-sm">
        <option value="">Pick a part…</option>
        {p.boards.filter(b => !not.includes(b.id)).map(b => <option key={b.id} value={b.id}>{partNameOf(p, b.id)}</option>)}
      </select>
    </label>
  )
}

export function RuleDialog({ board, onClose }: { board: Board; onClose(): void }) {
  const p = useStudio(s => s.project)
  const selection = useStudio(s => s.selection)
  const [kind, setKind] = useState<RuleKind>('spacing')
  const [axis, setAxis] = useState<Axis3>('z')
  const [axes, setAxes] = useState<Axis3[]>(['x'])
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [parts, setParts] = useState<string[]>(selection.length ? selection : [board.id])
  const [side, setSide] = useState<'min' | 'max'>('max')
  const [gap, setGap] = useState('0')
  const [expr, setExpr] = useState('3')
  const [error, setError] = useState<string | null>(null)
  const others = p.boards.filter(b => b.id !== board.id)

  const add = () => {
    let r: NewRule
    if (kind === 'spacing') r = { kind, axis, from, to, parts }
    else if (kind === 'center') r = { kind, axes, part: board.id, on: to }
    else if (kind === 'gap') {
      const g = gap.trim()
      if (g.startsWith('=')) r = { kind, axis, part: board.id, to, side, gap: 0, gapExpr: g.slice(1).trim() }
      else {
        const v = parseInches(g, { allowZero: true })
        if (!v.ok) return setError(v.reason)
        r = { kind, axis, part: board.id, to, side, gap: v.value }
      }
    } else r = { kind, expr: expr.replace(/^=/, '').trim(), first: board.id, copies: [], axis, from, to }
    const next = addRule(studio.getState().project, r)
    if ('error' in next) return setError(next.error)
    studio.getState().apply(() => next)
    onClose()
  }

  return (
    <div role="dialog" aria-label="Add a rule" className="flex flex-col gap-2 rounded border border-amber-300 bg-amber-50 p-2 text-sm">
      <label className="flex flex-col text-xs text-stone-600">Rule
        <select aria-label="Rule" value={kind} onChange={e => { setKind(e.target.value as RuleKind); setError(null) }} className="rounded border border-stone-300 px-1 py-1 text-sm">
          {KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </label>
      {kind !== 'center' && (
        <label className="flex flex-col text-xs text-stone-600">Direction
          <select aria-label="Direction" value={axis} onChange={e => setAxis(e.target.value as Axis3)} className="rounded border border-stone-300 px-1 py-1 text-sm">
            {AXES.map(([a, l]) => <option key={a} value={a}>{l}</option>)}
          </select>
        </label>
      )}
      {kind === 'center' && (
        <fieldset className="flex flex-wrap gap-2 text-xs"><legend className="text-stone-600">Directions</legend>
          {AXES.map(([a, l]) => (
            <label key={a} className="flex items-center gap-1"><input type="checkbox" checked={axes.includes(a)} onChange={() => setAxes(x => (x.includes(a) ? x.filter(y => y !== a) : [...x, a]))} />{l}</label>
          ))}
        </fieldset>
      )}
      {(kind === 'spacing' || kind === 'count') && (
        <>
          <PartSelect p={p} label="Between" value={from} onChange={setFrom} not={kind === 'count' ? [board.id] : parts} />
          <PartSelect p={p} label="And" value={to} onChange={setTo} not={kind === 'count' ? [board.id, from] : [...parts, from]} />
        </>
      )}
      {kind === 'spacing' && (
        <fieldset className="flex max-h-32 flex-col overflow-y-auto text-xs"><legend className="text-stone-600">Parts to space</legend>
          {p.boards.filter(b => b.id !== from && b.id !== to).map(b => (
            <label key={b.id} className="flex items-center gap-1"><input type="checkbox" checked={parts.includes(b.id)} onChange={() => setParts(x => (x.includes(b.id) ? x.filter(y => y !== b.id) : [...x, b.id]))} />{partNameOf(p, b.id)}</label>
          ))}
        </fieldset>
      )}
      {(kind === 'center' || kind === 'gap') && (
        <PartSelect p={p} label={kind === 'center' ? 'Centered on' : 'From'} value={to} onChange={setTo} not={[board.id]} />
      )}
      {kind === 'gap' && (
        <>
          <label className="flex flex-col text-xs text-stone-600">Which side
            <select aria-label="Which side" value={side} onChange={e => setSide(e.target.value as 'min' | 'max')} className="rounded border border-stone-300 px-1 py-1 text-sm">
              <option value="max">Past its far side</option>
              <option value="min">Before its near side</option>
            </select>
          </label>
          <label className="flex flex-col text-xs text-stone-600">Gap (0 = flush; a size or =formula)
            <input aria-label="Gap" value={gap} onChange={e => setGap(e.target.value)} className="rounded border border-stone-300 px-2 py-1" />
          </label>
        </>
      )}
      {kind === 'count' && (
        <label className="flex flex-col text-xs text-stone-600">How many (a number or =formula)
          <input aria-label="How many" value={expr} onChange={e => setExpr(e.target.value)} className="rounded border border-stone-300 px-2 py-1" />
        </label>
      )}
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
      <div className="flex justify-end gap-1">
        <button onClick={onClose} className="rounded px-2 py-0.5 text-xs hover:bg-amber-100">Cancel</button>
        <button onClick={add} disabled={!others.length} className="rounded bg-amber-700 px-3 py-0.5 text-xs font-semibold text-white">Add rule</button>
      </div>
    </div>
  )
}

/** The rules touching this part, each with a remove button, and "Add a rule". */
export function RulesOnPart({ board }: { board: Board }) {
  const p = useStudio(s => s.project)
  const errors = useStudio(s => s.formulaErrors)
  const [adding, setAdding] = useState(false)
  const list = rulesOn(p, board.id)
  return (
    <details open={list.length > 0 || adding || undefined} className="rounded border border-stone-200 p-2">
      <summary className="cursor-pointer text-sm font-semibold">Rules</summary>
      <div className="mt-2 flex flex-col gap-2 text-sm">
        {list.length > 0 && (
          <ul aria-label="Rules on this part" className="flex flex-col gap-1">
            {list.map(r => (
              <li key={r.id} className="flex flex-col rounded bg-stone-100 px-2 py-0.5 text-xs">
                <span className="flex items-center justify-between">
                  {ruleLabel(p, r)}
                  <button aria-label={`Remove ${ruleLabel(p, r)}`} onClick={() => studio.getState().apply(q => removeRule(q, r.id))} className="px-1 font-bold text-stone-500 hover:text-red-700">✕</button>
                </span>
                {errors[`rule:${r.id}`] && <span className="text-red-700">{errors[`rule:${r.id}`]}</span>}
              </li>
            ))}
          </ul>
        )}
        {adding ? <RuleDialog board={board} onClose={() => setAdding(false)} /> : (
          <button onClick={() => setAdding(true)} className="self-start rounded border border-stone-300 px-2 py-0.5 text-xs hover:bg-stone-100">Add a rule</button>
        )}
      </div>
    </details>
  )
}
