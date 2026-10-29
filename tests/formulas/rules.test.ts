import { worldBox } from '../../src/model/geometry'
import { addBoard, deleteBoards, rotateBoard } from '../../src/model/ops'
import type { Project } from '../../src/model/types'
import { emptyProject } from '../../src/model/woods'
import { setSize } from '../../src/formulas/ops'
import { recalc } from '../../src/formulas/recalc'
import { addRule, controlledBy } from '../../src/formulas/rules'
import { applyTemplate, unlock } from '../../src/templates'

const ok = (r: Project | { error: string }): Project => { if ('error' in r) throw new Error(r.error); return r }
const bx = (p: Project, id: string) => worldBox(p.boards.find(b => b.id === id)!)
function add(p: Project, name: string, wood: string, at: number, extra: { length?: number; width?: number; thickness?: number } = {}) {
  const r = addBoard(p, { woodId: wood, name, width: extra.width ?? 4, length: extra.length ?? 10, position: { x: at, y: 0, z: 0 }, ...(extra.thickness ? { thickness: extra.thickness } : {}) })
  return { p: r.project, id: r.id }
}
/** Boards standing on end along x: their x size is their thickness. */
function upright(p: Project, id: string) { return rotateBoard(p, id, 'y', 90) }

test('equal spacing between two ends, parts of different thickness', () => {
  let p = emptyProject('T')
  const ids: string[] = []
  for (const [n, at, t] of [['L', 0, 0.75], ['R', 30, 0.75], ['A', 3, 0.75], ['B', 9, 0.75], ['C', 12, 1.5]] as const) {
    const r = add(p, n, '1x6', at, { thickness: t }); p = r.p; ids.push(r.id)
  }
  // Flat boards: x size is the width (4"); L ends at 4, R starts at 30.
  p = ok(addRule(p, { kind: 'spacing', axis: 'x', from: ids[0], to: ids[1], parts: [ids[2], ids[3], ids[4]] }))
  const q = recalc(p).project
  const xs = [ids[2], ids[3], ids[4]].map(id => bx(q, id))
  const gaps = [xs[0].min.x - 4, xs[1].min.x - xs[0].max.x, xs[2].min.x - xs[1].max.x, 30 - xs[2].max.x]
  for (const g of gaps) expect(g).toBeCloseTo(3.5, 1)
  expect(controlledBy(q, ids[3], 'x')?.kind).toBe('spacing')
})

test('centred on two axes', () => {
  let p = emptyProject('T')
  const a = add(p, 'Front', '1x12', 0, { width: 11.25, length: 20 }); p = a.p
  const b = add(p, 'Pull', '1x2', 30, { width: 1.5, length: 4 }); p = b.p
  p = ok(addRule(p, { kind: 'center', axes: ['x', 'y'], part: b.id, on: a.id }))
  const q = recalc(p).project
  const A = bx(q, a.id), B = bx(q, b.id)
  expect((B.min.x + B.max.x) / 2).toBeCloseTo((A.min.x + A.max.x) / 2, 6)
  expect((B.min.y + B.max.y) / 2).toBeCloseTo((A.min.y + A.max.y) / 2, 6)
})

test('a gap on the far side, flush on the near side, and a gap that follows a size', () => {
  let p = emptyProject('T')
  const a = add(p, 'Case', '1x6', 0); p = a.p
  const b = add(p, 'Door', '1x6', 20); p = b.p
  p = ok(addRule(p, { kind: 'gap', axis: 'x', part: b.id, to: a.id, side: 'max', gap: 0.125 }))
  expect(bx(recalc(p).project, b.id).min.x).toBe(4.125)
  p = { ...p, rules: [] }
  p = ok(addRule(p, { kind: 'gap', axis: 'x', part: b.id, to: a.id, side: 'min', gap: 0 }))
  expect(bx(recalc(p).project, b.id).max.x).toBe(0)
  p = { ...p, rules: [] }
  p = ok(setSize(p, 'Reveal', '1/16'))
  p = ok(addRule(p, { kind: 'gap', axis: 'x', part: b.id, to: a.id, side: 'max', gap: 0, gapExpr: 'Reveal * 2' }))
  expect(bx(recalc(p).project, b.id).min.x).toBe(4.125)
})

test('a count adds copies with their dados, and takes them away again', () => {
  let p = unlock(applyTemplate(emptyProject('Shelf'), 'bookshelf', { shelves: 3 }))
  p = { ...p, sizes: [], rules: [] }
  const shelves = p.boards.filter(b => b.name === 'Shelf').map(b => b.id)
  const top = p.boards.find(b => b.name === 'Top')!.id, bottom = p.boards.find(b => b.name === 'Bottom')!.id
  p = ok(addRule(p, { kind: 'count', expr: '5', first: shelves[0], copies: shelves.slice(1), axis: 'z', from: bottom, to: top }))
  const joints0 = p.joints.length
  let q = recalc(p).project
  expect(q.boards.filter(b => b.name === 'Shelf')).toHaveLength(5)
  expect(q.joints.length).toBe(joints0 + 4)
  q = { ...q, rules: q.rules!.map(r => (r.kind === 'count' ? { ...r, expr: '2' } : r)) }
  q = recalc(q).project
  expect(q.boards.filter(b => b.name === 'Shelf')).toHaveLength(2)
  expect(q.joints.length).toBe(joints0 - 2)
})

test('two rules placing the same part the same way: the second is skipped and named', () => {
  let p = emptyProject('T')
  const a = add(p, 'Front', '1x12', 0, { width: 11.25 }); p = a.p
  const b = add(p, 'Pull', '1x2', 30, { width: 1.5 }); p = b.p
  p = ok(addRule(p, { kind: 'center', axes: ['x'], part: b.id, on: a.id }))
  p = ok(addRule(p, { kind: 'gap', axis: 'x', part: b.id, to: a.id, side: 'max', gap: 2 }))
  const r = recalc(p)
  expect(r.errors.map(e => e.message)).toEqual(['These rules disagree: Centered (Pull on Front) and Gap 2" (Pull) — remove one'])
  const A = bx(r.project, a.id), B = bx(r.project, b.id)
  expect((B.min.x + B.max.x) / 2).toBeCloseTo((A.min.x + A.max.x) / 2, 6)
})

test('deleting the first part removes its count rule', () => {
  let p = emptyProject('T')
  const a = add(p, 'L', '1x6', 0); p = a.p
  const b = add(p, 'R', '1x6', 40); p = b.p
  const c = add(p, 'Slat', '1x2', 10, { width: 1.5 }); p = c.p
  p = ok(addRule(p, { kind: 'count', expr: '3', first: c.id, copies: [], axis: 'x', from: a.id, to: b.id }))
  p = recalc(p).project
  expect(p.boards.filter(x => x.name === 'Slat')).toHaveLength(3)
  const q = deleteBoards(p, [c.id])
  expect(q.rules).toEqual([])
})

test('spacing works on turned-around parts (their real box)', () => {
  let p = emptyProject('T')
  const a = add(p, 'L', '1x6', 0); p = a.p
  const b = add(p, 'R', '1x6', 30); p = b.p
  const c = add(p, 'Mid', '1x6', 10); p = c.p
  p = upright(p, c.id)
  p = ok(addRule(p, { kind: 'spacing', axis: 'x', from: a.id, to: b.id, parts: [c.id] }))
  const q = recalc(p).project
  const C = bx(q, c.id)
  expect(C.max.x - C.min.x).toBeCloseTo(0.75, 6)
  expect(C.min.x - 4).toBeCloseTo(30 - C.max.x, 6)
})
