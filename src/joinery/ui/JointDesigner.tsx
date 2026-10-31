// The joint designer: two beams on a grid of cells. Give each cell to beam A or B (in 3D or layer by layer), see
// at once whether it holds together, goes together, can be cut, and where it's weak; save it to use in the design.
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { useMemo, useState } from 'react'
import { newId } from '../../model/ids'
import type { CustomJoint } from '../../model/types'
import { formatInches } from '../../model/units'
import { studio, useStudio, type Screen } from '../../ui/store'
import { at, idx, preset, report, setCell, type Dir, type Grid } from '../voxel'

const NONE: CustomJoint[] = []
let backTo: Screen = 'master'
export function openJointDesigner(from: Screen) {
  backTo = from
  studio.getState().goto('joints')
}

const A_COLOUR = '#d9a066', B_COLOUR = '#6b8fc7', BAD = '#e53935'
const DIR_NAMES: Record<Dir, string> = { 'x+': 'B pulls out along the beams', 'x-': 'into A (not possible)', 'y+': 'B slides out sideways (+)', 'y-': 'B slides out sideways (−)', 'z+': 'B lifts out upward', 'z-': 'B drops out downward' }

export function JointDesigner() {
  const [g, setG] = useState<Grid>(() => preset('lap', 'inline', 4))
  const [size, setSize] = useState(3.5)
  const [layer, setLayer] = useState(0)
  const [name, setName] = useState('My joint')
  const [saved, setSaved] = useState<string | null>(null)
  const joints = useStudio(s => s.project.customJoints) ?? NONE
  const r = useMemo(() => report(g, size), [g, size])
  const bad = new Set([...r.loose.a, ...r.loose.b, ...r.unreachable.a, ...r.unreachable.b, ...r.short.a, ...r.short.b])
  const toggle = (i: number, j: number, k: number) => setG(x => setCell(x, i, j, k, at(x, i, j, k) === '0' ? '1' : '0'))
  const reset = (n: number, layout: Grid['layout'], p: Parameters<typeof preset>[0]) => { setG(preset(p, layout, n)); setLayer(0) }
  const save = () => {
    const cj: CustomJoint = { id: newId('k'), name: name.trim() || 'My joint', layout: g.layout, n: g.n, cells: g.cells, slide: r.slides[0] ?? 'x+' }
    studio.getState().apply(p => ({ ...p, customJoints: [...(p.customJoints ?? []), cj] }))
    setSaved(cj.name)
  }
  const pieceText = (cells: number[]) => cells.length ? `${cells.length} cell${cells.length === 1 ? '' : 's'}` : 'none'
  return (
    <main className="flex h-full flex-col bg-stone-50">
      <header className="flex flex-wrap items-center gap-3 border-b border-stone-300 bg-white px-4 py-2">
        <button className="rounded border px-3 py-1 text-sm hover:bg-stone-100" onClick={() => studio.getState().goto(backTo)}>← Back</button>
        <h1 className="text-xl font-bold">Joint designer</h1>
        <label className="text-sm">Layout <select aria-label="Layout" value={g.layout} onChange={e => reset(g.n, e.target.value as Grid['layout'], 'empty')} className="rounded border px-1">
          <option value="inline">End to end (splice)</option><option value="cross">Crossing beams</option></select></label>
        <label className="text-sm">Grid <select aria-label="Grid" value={g.n} onChange={e => reset(Number(e.target.value), g.layout, 'empty')} className="rounded border px-1">
          {[2, 3, 4, 5, 6, 7, 8].map(n => <option key={n} value={n}>{n} × {n} × {n}</option>)}</select></label>
        <label className="text-sm">Beam size <select aria-label="Beam size" value={size} onChange={e => setSize(Number(e.target.value))} className="rounded border px-1">
          {[1.5, 2.5, 3.5, 5.5, 7.25].map(s => <option key={s} value={s}>{formatInches(s)}</option>)}</select></label>
        <span className="text-sm">Start from:</span>
        {(['empty', 'lap', 'tenon', 'dovetail'] as const).map(p => <button key={p} className="rounded border px-2 py-0.5 text-sm" onClick={() => reset(g.n, g.layout, p)}>{p === 'empty' ? 'All A' : p[0].toUpperCase() + p.slice(1)}</button>)}
      </header>
      <div className="flex flex-1 overflow-hidden">
        <div className="relative flex-1">
          <Canvas camera={{ position: [g.n * 1.8, -g.n * 2.2, g.n * 1.6], up: [0, 0, 1], fov: 40 }}>
            <ambientLight intensity={0.7} />
            <directionalLight position={[5, -8, 10]} intensity={0.8} />
            <group position={[-g.n / 2, -g.n / 2, -g.n / 2]}>
              <Bodies g={g} />
              {Array.from({ length: g.n ** 3 }, (_, c) => {
                const i = c % g.n, j = Math.floor(c / g.n) % g.n, k = Math.floor(c / (g.n * g.n))
                const v = g.cells[c]
                return (
                  <mesh key={c} position={[i + 0.5, j + 0.5, k + 0.5]} onClick={e => { e.stopPropagation(); toggle(i, j, k) }}>
                    <boxGeometry args={[0.94, 0.94, 0.94]} />
                    <meshStandardMaterial color={bad.has(c) ? BAD : v === '0' ? A_COLOUR : B_COLOUR} />
                  </mesh>
                )
              })}
            </group>
            <OrbitControls makeDefault />
          </Canvas>
          <p className="pointer-events-none absolute left-3 top-2 text-xs text-stone-600">Click a cell to give it to the other beam. Drag to turn. <span style={{ color: A_COLOUR }}>■</span> A (the host) · <span style={{ color: B_COLOUR }}>■</span> B · <span style={{ color: BAD }}>■</span> a problem</p>
        </div>
        <aside className="flex w-96 flex-col gap-3 overflow-auto border-l border-stone-300 bg-white p-4">
          <section aria-label="Layer">
            <div className="mb-1 flex items-center gap-2 text-sm font-semibold">Layer
              <select aria-label="Layer number" value={layer} onChange={e => setLayer(Number(e.target.value))} className="rounded border px-1">{Array.from({ length: g.n }, (_, k) => <option key={k} value={k}>{k + 1} of {g.n} (from the bottom)</option>)}</select>
            </div>
            <div className="inline-grid gap-0.5" style={{ gridTemplateColumns: `repeat(${g.n}, 1.75rem)` }}>
              {Array.from({ length: g.n }, (_, jj) => g.n - 1 - jj).flatMap(j => Array.from({ length: g.n }, (_, i) => {
                const v = at(g, i, j, layer), c = idx(g.n, i, j, layer)
                return <button key={`${i}-${j}`} aria-label={`Cell ${i + 1},${j + 1},${layer + 1} ${v === '0' ? 'A' : 'B'}`} onClick={() => toggle(i, j, layer)}
                  className="h-7 w-7 rounded-sm border text-xs font-bold" style={{ background: bad.has(c) ? BAD : v === '0' ? A_COLOUR : B_COLOUR, color: '#fff' }}>{v === '0' ? 'A' : 'B'}</button>
              }))}
            </div>
            <p className="text-xs text-stone-500">{g.layout === 'inline' ? 'A comes in from the left, B from the right.' : 'A runs left to right, B front to back.'}</p>
          </section>
          <section role="status" aria-label="Feedback" className={`rounded-lg p-3 text-sm ${r.ok ? 'bg-green-50' : 'bg-red-50'}`}>
            <div className="text-lg font-bold">{r.ok ? 'This joint works' : 'Not yet'}</div>
            <ul className="mt-1 flex flex-col gap-0.5">
              <li>{r.slides.length ? `Goes together: ${r.slides.map(d => DIR_NAMES[d]).join('; ')}` : 'Can’t be put together — some of B is locked behind A in every direction'}</li>
              <li>Loose bits: A {pieceText(r.loose.a)}, B {pieceText(r.loose.b)}</li>
              <li>Cuts a tool can’t reach: A {pieceText(r.unreachable.a)}, B {pieceText(r.unreachable.b)}</li>
              <li>Thin necks: {[...r.weak.a.map(w => `A at slice ${w.slice + 1} (${Math.round(w.fraction * 100)}%)`), ...r.weak.b.map(w => `B at slice ${w.slice + 1} (${Math.round(w.fraction * 100)}%)`)].join(', ') || 'none'}</li>
              <li>Short grain: A {pieceText(r.short.a)}, B {pieceText(r.short.b)}</li>
              <li>Glue/contact area: {r.area.toFixed(1)} sq in</li>
            </ul>
          </section>
          <section className="flex flex-col gap-2">
            <label className="flex flex-col text-xs">Name<input aria-label="Joint name" value={name} onChange={e => setName(e.target.value)} className="rounded border px-2 py-1 text-sm" /></label>
            <button disabled={!r.ok} onClick={save} className="rounded bg-amber-700 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40">Save to this project</button>
            {saved && <p role="status" className="text-xs text-green-800">Saved “{saved}”. Select two {g.layout === 'inline' ? 'beams that meet end to end' : 'crossing parts'} and pick it under Cut joints.</p>}
            {joints.length > 0 && <p className="text-xs text-stone-600">In this project: {joints.map(j => j.name).join(', ')}</p>}
          </section>
        </aside>
      </div>
    </main>
  )
}

/** The beams' bodies outside the grid, see-through. */
function Bodies({ g }: { g: Grid }) {
  const n = g.n
  const box = (pos: [number, number, number], sz: [number, number, number], c: string, k: string) => (
    <mesh key={k} position={pos} raycast={() => null}><boxGeometry args={sz} /><meshStandardMaterial color={c} transparent opacity={0.25} /></mesh>
  )
  if (g.layout === 'inline') return <>{box([-n / 2, n / 2, n / 2], [n, n, n], A_COLOUR, 'a')}{box([n * 1.5, n / 2, n / 2], [n, n, n], B_COLOUR, 'b')}</>
  return <>{box([-n / 2, n / 2, n / 2], [n, n, n], A_COLOUR, 'a1')}{box([n * 1.5, n / 2, n / 2], [n, n, n], A_COLOUR, 'a2')}{box([n / 2, -n / 2, n / 2], [n, n, n], B_COLOUR, 'b1')}{box([n / 2, n * 1.5, n / 2], [n, n, n], B_COLOUR, 'b2')}</>
}
