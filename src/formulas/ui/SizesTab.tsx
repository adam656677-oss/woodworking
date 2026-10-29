// The Sizes tab: named sizes (name, value or formula, result) and the design's layout rules.
import { useEffect, useMemo, useState } from 'react'
import type { Project } from '../../model/types'
import { formatInches } from '../../model/units'
import { studio, useStudio } from '../../ui/store'
import { deleteSize, renameSize, setSize } from '../ops'
import { recalcFormulas } from '../recalc'
import { removeRule, ruleLabel } from '../rules'

function apply(fn: (p: Project) => Project | { error: string }, setError: (m: string | null) => void) {
  const r = fn(studio.getState().project)
  if ('error' in r) return setError(r.error)
  setError(null)
  studio.getState().apply(() => r)
}

function SizeRow({ name, expr, result, error, plain }: { name: string; expr: string; result: number | undefined; error?: string; plain?: boolean }) {
  const [n, setN] = useState(name)
  const [e, setE] = useState(expr)
  const [msg, setMsg] = useState<string | null>(null)
  const [editing, setEditing] = useState<'name' | 'expr' | null>(null)
  // Follow changes made elsewhere (a rename, an undo) unless that box is being typed in.
  useEffect(() => { if (editing !== 'name') setN(name) }, [name, editing])
  useEffect(() => { if (editing !== 'expr') setE(expr) }, [expr, editing])
  return (
    <li className="flex flex-col gap-0.5 border-b border-stone-100 py-1">
      <div className="flex items-center gap-1">
        <input aria-label={`Name of ${name}`} value={n} onChange={x => setN(x.target.value)} onFocus={() => setEditing('name')}
          onBlur={() => { setEditing(null); if (n.trim() && n.trim() !== name) apply(p => renameSize(p, name, n.trim()), setMsg); else setN(name) }}
          onKeyDown={x => { if (x.key === 'Enter') (x.target as HTMLInputElement).blur() }}
          className="min-w-0 flex-1 rounded border border-transparent px-1 font-semibold hover:border-stone-300" />
        <span className="shrink-0 text-right text-xs text-stone-600" data-testid={`result-${name}`}>{result === undefined ? '—' : plain ? String(Math.round(result * 1000) / 1000) : formatInches(result)}</span>
        <button aria-label={`Delete ${name}`} onClick={() => apply(p => deleteSize(p, name), setMsg)} className="px-1 text-stone-400 hover:text-red-700">✕</button>
      </div>
      <div className="flex items-center gap-1 pl-1">
        <span className="text-stone-500">=</span>
        <input aria-label={`Value of ${name}`} value={e} onChange={x => setE(x.target.value)} onFocus={() => setEditing('expr')}
          onBlur={() => { setEditing(null); if (e.trim() !== expr) apply(p => setSize(p, name, e), setMsg) }}
          onKeyDown={x => { if (x.key === 'Enter') (x.target as HTMLInputElement).blur() }}
          className="min-w-0 flex-1 rounded border border-stone-300 px-1 font-mono text-xs" />
      </div>
      {(msg ?? error) && <span role="alert" className="text-xs text-red-700">{msg ?? error}</span>}
    </li>
  )
}

export function SizesTab() {
  const project = useStudio(s => s.project)
  const errors = useStudio(s => s.formulaErrors)
  const values = useMemo(() => recalcFormulas(project).sizes, [project])
  const [name, setName] = useState('')
  const [expr, setExpr] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const sizes = project.sizes ?? []
  const rules = project.rules ?? []
  // Sizes that only count things (used by a count rule) show as plain numbers, not inches.
  const counts = useMemo(() => new Set(rules.flatMap(r => (r.kind === 'count' ? (r.expr.toLowerCase().match(/[a-z_][a-z0-9_]*/g) ?? []) : []))), [rules])
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-2 text-sm" aria-label="Sizes">
      <p className="mb-1 text-xs text-stone-500">Name a size, then type =Name (or a formula like =H - 2*T) in any size box.</p>
      <ul aria-label="Named sizes">
        {sizes.map(s => <SizeRow key={s.name} name={s.name} expr={s.expr} result={values.get(s.name.toLowerCase())} error={errors[`size:${s.name.toLowerCase()}`]} plain={counts.has(s.name.toLowerCase())} />)}
      </ul>
      <form className="mt-2 flex items-center gap-1" onSubmit={e => {
        e.preventDefault()
        if (!name.trim()) return setMsg('Give the size a name')
        if (sizes.some(s => s.name.toLowerCase() === name.trim().toLowerCase())) return setMsg(`There is already a size called ${name.trim()}`)
        apply(p => setSize(p, name.trim(), expr || '0'), setMsg)
        if (name.trim()) { setName(''); setExpr('') }
      }}>
        <input aria-label="New size name" placeholder="Name" value={name} onChange={e => setName(e.target.value)} className="w-20 rounded border border-stone-300 px-1" />
        <span>=</span>
        <input aria-label="New size value" placeholder="30 or H/2" value={expr} onChange={e => setExpr(e.target.value)} className="min-w-0 flex-1 rounded border border-stone-300 px-1" />
        <button type="submit" className="rounded bg-amber-700 px-2 py-0.5 text-xs font-semibold text-white">Add size</button>
      </form>
      {msg && <p role="alert" className="text-xs text-red-700">{msg}</p>}
      <h3 className="mt-4 text-xs font-bold uppercase tracking-wide text-stone-500">Rules ({rules.length})</h3>
      {rules.length === 0 && <p className="text-xs text-stone-500">Add rules from a part&apos;s properties (Rules → Add a rule).</p>}
      <ul aria-label="All rules">
        {rules.map(r => (
          <li key={r.id} className="flex flex-col border-b border-stone-100 py-1 text-xs">
            <span className="flex items-center justify-between">{ruleLabel(project, r)}
              <button aria-label={`Remove ${ruleLabel(project, r)}`} onClick={() => studio.getState().apply(p => removeRule(p, r.id))} className="px-1 text-stone-400 hover:text-red-700">✕</button>
            </span>
            {errors[`rule:${r.id}`] && <span className="text-red-700">{errors[`rule:${r.id}`]}</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}
