// The turning sheet: layout marks, caliper stations, and the profile full size to hold against the work.
import { sketchOf } from '../../model/shaped'
import type { Board } from '../../model/types'
import { formatInches } from '../../model/units'
import { FullSizePages } from '../../sketch/ui/FullSizePrint'
import { newSketch, type Sketch } from '../../sketch/types'
import { useStudio } from '../../ui/store'
import { stations } from '../turning'
import { STYLE_NAMES } from './TurningSection'

/** The whole leg's silhouette for printing: the profile on both sides of the centre, and the square blank's outline. */
export function silhouette(profile: Sketch, b: Board): Sketch {
  const s = newSketch(`${profile.id}_print`, `${b.name} — turning profile`, 'precise')
  const B = b.width / 2
  const live = profile.entities.filter(e => e.kind !== 'text' && !('construction' in e && e.construction))
  const used = new Set(live.flatMap(e => (e.kind === 'line' ? [e.a, e.b] : e.kind === 'arc' ? [e.center, e.start, e.end] : e.kind === 'circle' ? [e.center] : e.kind === 'spline' ? e.points : [])))
  for (const p of profile.points) if (used.has(p.id)) s.points.push({ ...p }, { id: `${p.id}_m`, x: p.x, y: -p.y })
  const m = (id: string) => `${id}_m`
  for (const e of live) {
    s.entities.push(e)
    if (e.kind === 'line') s.entities.push({ ...e, id: m(e.id), a: m(e.a), b: m(e.b) })
    else if (e.kind === 'arc') s.entities.push({ ...e, id: m(e.id), center: m(e.center), start: m(e.end), end: m(e.start) })
    else if (e.kind === 'spline') s.entities.push({ ...e, id: m(e.id), points: e.points.map(m) })
  }
  // The blank: its outline, and the pommel and foot lines to mark before turning.
  const t = b.turning!
  const L = b.length
  const P = (id: string, x: number, y: number) => { s.points.push({ id, x, y }); return id }
  const corners = [P('b1', 0, -B), P('b2', L, -B), P('b3', L, B), P('b4', 0, B)]
  corners.forEach((c, i) => s.entities.push({ id: `blank${i}`, kind: 'line', a: c, b: corners[(i + 1) % 4] }))
  s.entities.push({ id: 'pommel', kind: 'line', a: P('t1', t.top, -B), b: P('t2', t.top, B) })
  if (t.bottom > 0) s.entities.push({ id: 'foot', kind: 'line', a: P('f1', L - t.bottom, -B), b: P('f2', L - t.bottom, B) })
  return s
}

export function TurningSheet({ board, onClose }: { board: Board; onClose(): void }) {
  const project = useStudio(s => s.project)
  const t = board.turning!
  const profile = sketchOf(project, t.sketchId)
  const st = stations(project, board)
  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-stone-200 print:static print:bg-white" role="dialog" aria-label="Turning sheet">
      <header className="flex items-center gap-3 border-b border-stone-300 bg-white px-4 py-2 print:hidden">
        <button onClick={onClose} className="rounded px-3 py-1 font-semibold hover:bg-stone-200">← Back to the design</button>
        <h1 className="text-lg font-bold">Turning sheet — {board.name}</h1>
        <span className="flex-1" />
        <button onClick={() => void window.aa?.print({ landscape: false })} className="rounded bg-amber-700 px-4 py-1.5 font-semibold text-white">Print</button>
      </header>
      <p className="bg-amber-50 px-4 py-2 text-sm text-amber-900 print:hidden">Print at <strong>Actual size</strong> (100%) so the profile pages are true size; check the 1&quot; square.</p>
      <div className="min-h-0 flex-1 overflow-auto p-6 print:overflow-visible print:p-0">
        <div className="print-area flex flex-col items-center gap-6 print:gap-0">
          <section aria-label="Turning summary" className="shrink-0 bg-white p-[0.4in] text-[10pt] text-gray-900 shadow print:shadow-none" style={{ width: '7.5in', minHeight: '10in', breakAfter: 'page' }}>
            <h2 className="text-[18pt] font-bold">{board.name} — turning sheet</h2>
            <p>{STYLE_NAMES[t.style]} · blank {formatInches(board.width)} × {formatInches(board.thickness)} × {formatInches(board.length)}</p>
            <h3 className="mt-3 font-bold">Lay out before turning</h3>
            <ul className="list-disc pl-5">
              <li>Mark the pommel {formatInches(t.top)} from the top end on all four faces.</li>
              {t.bottom > 0 && <li>Mark the square foot {formatInches(t.bottom)} from the bottom end.</li>}
              <li>{t.shoulder === 'crisp' ? 'Nick the corners at the line with a skew or parting tool before roughing, so the square edges stay crisp.' : 'Round the corners at the line into a lamb’s tongue with a spindle gouge.'}</li>
              <li>Rough the section between the marks round, then size it at each station below.</li>
            </ul>
            <h3 className="mt-3 font-bold">Caliper stations</h3>
            <table className="mt-1 w-full border-collapse text-left" aria-label="Stations">
              <thead><tr className="border-b-2 border-gray-500"><th className="py-0.5">From the top</th><th>Diameter</th></tr></thead>
              <tbody>
                {st.map(s => <tr key={s.at} className="border-b border-gray-200"><td className="py-0.5">{formatInches(s.at)}</td><td>{formatInches(s.diameter)}</td></tr>)}
              </tbody>
            </table>
            <p className="mt-3 text-[9pt] text-gray-600">The pages after this one show the profile full size: cut it out as a template, or hold it against the work.</p>
          </section>
          {profile && <FullSizePages sketch={silhouette(profile, board)} />}
        </div>
      </div>
    </div>
  )
}
