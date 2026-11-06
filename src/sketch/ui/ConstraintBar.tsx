import type { ReactNode } from 'react'
import { describeConstraint, draw, useDraw } from '../drawStore'
import type { ConstraintKind, Sketch } from '../types'

type Kind = 'point' | 'line' | 'round' | 'other'

function kindOf(sk: Sketch, id: string): Kind {
  if (sk.points.some(p => p.id === id)) return 'point'
  const e = sk.entities.find(x => x.id === id)
  if (!e) return 'other'
  return e.kind === 'line' ? 'line' : e.kind === 'arc' || e.kind === 'circle' ? 'round' : 'other'
}

/** Which rules fit what is selected, and in what order to pass it to the solver. */
export function rulesFor(sk: Sketch, sel: string[]): { kind: ConstraintKind; label: string; refs: string[] | null; title: string }[] {
  const ks = sel.map(id => kindOf(sk, id))
  const count = (k: Kind) => ks.filter(x => x === k).length
  const pick = (k: Kind) => sel.filter((_, i) => ks[i] === k)
  const only = (...want: Kind[]) => ks.length === want.length && want.every(k => count(k) === want.filter(w => w === k).length)
  const lines = pick('line'), pts = pick('point'), rounds = pick('round')
  return [
    { kind: 'horizontal', label: 'Level', title: 'Make a line (or two points) level', refs: only('line') ? lines : only('point', 'point') ? pts : null },
    { kind: 'vertical', label: 'Upright', title: 'Make a line (or two points) straight up and down', refs: only('line') ? lines : only('point', 'point') ? pts : null },
    { kind: 'perpendicular', label: 'Square', title: 'Two lines at 90°', refs: only('line', 'line') ? lines : null },
    { kind: 'parallel', label: 'Parallel', title: 'Two lines running the same way', refs: only('line', 'line') ? lines : null },
    { kind: 'equal', label: 'Equal', title: 'Same length (lines) or same size (circles and arcs)', refs: only('line', 'line') ? lines : only('round', 'round') ? rounds : null },
    { kind: 'tangent', label: 'Tangent', title: 'A line just touching a curve, or two curves touching', refs: only('line', 'round') ? [...lines, ...rounds] : only('round', 'round') ? rounds : null },
    { kind: 'concentric', label: 'Same centre', title: 'Circles or arcs sharing a centre', refs: only('round', 'round') ? rounds : null },
    { kind: 'coincident', label: 'Touching', title: 'Two points together, or a point on a line or curve', refs: only('point', 'point') ? pts : only('point', 'line') ? [...pts, ...lines] : only('point', 'round') ? [...pts, ...rounds] : null },
    { kind: 'fixed', label: 'Fix in place', title: 'Pin points where they are', refs: pts.length >= 1 && ks.every(k => k === 'point') ? pts : null },
    { kind: 'symmetric', label: 'Symmetric', title: 'Two points mirrored across a line', refs: only('point', 'point', 'line') ? [...pts, ...lines] : null }
  ]
}

export function ConstraintBar({ onDistance, onAngle, review }: { onDistance(refs: string[]): void; onAngle(refs: string[]): void; review?: ReactNode }) {
  const sketch = useDraw(s => s.sketch)
  const selection = useDraw(s => s.selection)
  const solve = useDraw(s => s.solve)
  const s = draw.getState()
  const rules = rulesFor(sketch, selection)
  const ks = selection.map(id => kindOf(sketch, id))
  const pointLine = ks.length === 2 && ks.includes('point') && ks.includes('line')
  const twoLines = ks.length === 2 && ks.every(k => k === 'line')
  const conflict = solve.status === 'conflict'
  return (
    <aside aria-label="Rules and dimensions" className="flex w-60 shrink-0 flex-col gap-2 overflow-y-auto border-l border-stone-300 bg-white p-2 text-sm">
      <div data-testid="solve-status" className={`rounded px-2 py-1 font-semibold ${conflict ? 'bg-red-100 text-red-800' : solve.dof === 0 && sketch.constraints.length ? 'bg-stone-800 text-white' : 'bg-blue-50 text-blue-800'}`}>
        {conflict ? 'Rules disagree' : solve.dof === 0 && sketch.constraints.length ? 'Fully fixed ✓' : solve.dof > 0 ? `Can still move (${solve.dof})` : 'Free to move'}
      </div>
      <p className="text-xs text-stone-500">Blue can still move, black is fully fixed, red disagrees.</p>
      {review}
      <h2 className="text-xs font-semibold uppercase text-stone-500">Rules for the selection</h2>
      <div className="grid grid-cols-2 gap-1">
        {rules.map(r => (
          <button key={r.kind} title={r.title} disabled={!r.refs} onClick={() => { s.addConstraint(r.kind, r.refs!) }}
            className="rounded border border-stone-300 px-1 py-1 text-xs hover:bg-amber-50 disabled:opacity-30">{r.label}</button>
        ))}
        <button title="Distance from a point to a line" disabled={!pointLine} onClick={() => onDistance([selection[ks.indexOf('point')], selection[ks.indexOf('line')]])}
          className="rounded border border-stone-300 px-1 py-1 text-xs hover:bg-amber-50 disabled:opacity-30">Distance</button>
        <button title="Angle between two lines" disabled={!twoLines} onClick={() => onAngle(selection)}
          className="rounded border border-stone-300 px-1 py-1 text-xs hover:bg-amber-50 disabled:opacity-30">Angle</button>
      </div>
      {conflict && (
        <div role="alert" className="rounded border border-red-300 bg-red-50 p-2 text-red-800">
          <p className="font-semibold">Remove one of these:</p>
          <ul>
            {solve.conflicting.map(id => {
              const c = sketch.constraints.find(x => x.id === id)
              return c ? (
                <li key={id} className="flex items-center justify-between">
                  {describeConstraint(c)}
                  <button aria-label={`Remove ${describeConstraint(c)}`} onClick={() => s.remove([id])} className="px-1 font-bold">✕</button>
                </li>
              ) : null
            })}
          </ul>
        </div>
      )}
      <h2 className="text-xs font-semibold uppercase text-stone-500">Rules and dimensions ({sketch.constraints.length})</h2>
      <ul className="flex flex-col">
        {sketch.constraints.map(c => (
          <li key={c.id} className={`flex items-center justify-between rounded px-1 ${selection.includes(c.id) ? 'bg-amber-100' : ''} ${solve.conflicting.includes(c.id) ? 'text-red-700' : ''}`}>
            <button className="flex-1 text-left" onClick={() => s.select([c.id, ...c.refs])}>{describeConstraint(c)}</button>
            <button aria-label={`Remove ${describeConstraint(c)}`} onClick={() => s.remove([c.id])} className="px-1 text-stone-400 hover:text-red-700">✕</button>
          </li>
        ))}
      </ul>
    </aside>
  )
}
