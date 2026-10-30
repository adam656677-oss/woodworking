import { emptyProject } from '../../src/model/woods'
import { makeBoard, ORIENT } from '../../src/templates/place'
import { viewLines, VIEWS } from '../../src/drawings/lines'
import type { Project } from '../../src/model/types'

const ply = emptyProject('T').woods.find(w => w.id === 'ply-3-4')!
const total = (segs: { a: number[]; b: number[] }[]) => segs.reduce((n, s) => n + Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]), 0)

test('a panel seen from the front is a rectangle of visible lines', () => {
  const b = makeBoard('Panel', ply, 10, 20, ORIENT.uprightX, { x: 0, y: 0, z: 0 })
  const p: Project = { ...emptyProject('T'), boards: [b] }
  const l = viewLines(p, VIEWS.front)
  expect(l.min).toEqual([0, 0])
  expect(l.max.map(v => Math.round(v * 1e4) / 1e4)).toEqual([10, 20])
  expect(l.segs.every(s => !s.hidden)).toBe(true)
  expect(total(l.segs)).toBeCloseTo(60, 3)
})

test('a part behind another shows hidden (dashed) where it is covered', () => {
  const front = makeBoard('Front', ply, 10, 20, ORIENT.uprightX, { x: 0, y: 0, z: 0 })
  const back = makeBoard('Back', ply, 4, 6, ORIENT.uprightX, { x: 3, y: 5, z: 3 })
  const p: Project = { ...emptyProject('T'), boards: [front, back] }
  const l = viewLines(p, VIEWS.front)
  const backSegs = l.segs.filter(s => s.boardId === back.id)
  expect(backSegs.length).toBeGreaterThan(0)
  expect(backSegs.every(s => s.hidden)).toBe(true)
  expect(total(backSegs)).toBeCloseTo(20, 2)
  // Left without hidden lines, it's gone.
  expect(viewLines(p, VIEWS.front, { hidden: false }).segs.some(s => s.boardId === back.id)).toBe(false)
})

test('partly covered: a long part sticking out past the front panel is half visible', () => {
  const front = makeBoard('Front', ply, 10, 20, ORIENT.uprightX, { x: 0, y: 0, z: 0 })
  const rail = makeBoard('Rail', ply, 2, 20, ORIENT.wallX, { x: 5, y: 5, z: 5 })
  const l = viewLines({ ...emptyProject('T'), boards: [front, rail] }, VIEWS.front)
  const r = l.segs.filter(s => s.boardId === rail.id)
  const vis = total(r.filter(s => !s.hidden)), hid = total(r.filter(s => s.hidden))
  expect(vis).toBeGreaterThan(10)
  expect(hid).toBeGreaterThan(8)
})

test('a turned leg draws its outline (silhouette) all along its length', async () => {
  const { addBoard } = await import('../../src/model/ops')
  const { findWood } = await import('../../src/model/woods')
  const { turnBoard } = await import('../../src/shaping/turning')
  const { FACE } = await import('../../src/drawings/views')
  const p0 = emptyProject('T')
  p0.woods.push({ ...findWood(p0, '2x2')!, id: 'blank175', name: '1-3/4 blank', thickness: 1.75, width: 1.75, builtIn: false })
  const r = addBoard(p0, { woodId: 'blank175', name: 'Leg', width: 1.75, length: 29 })
  const t = turnBoard(r.project, r.id, { style: 'vase', top: 5, bottom: 1 })
  if ('error' in t) throw new Error(t.error)
  const l = viewLines(t.project, FACE, { ids: [r.id], local: true, hidden: false })
  // Visible line work covers the whole turned stretch from 1" to 24".
  for (let u = 2; u < 23; u += 1) expect(l.segs.some(s => Math.min(s.a[0], s.b[0]) <= u && Math.max(s.a[0], s.b[0]) >= u)).toBe(true)
}, 60000)

test('the bookshelf: hidden lines are single runs (no overlaps on a line) and no stray diagonals', async () => {
  const { applyTemplate } = await import('../../src/templates')
  const { template: _t, ...p } = applyTemplate(emptyProject('B'), 'bookshelf', {})
  for (const v of [VIEWS.front, VIEWS.side, VIEWS.top]) {
    const l = viewLines(p, v)
    // Front, side and top views of a box of rectangles have only level and upright lines.
    for (const s of l.segs) expect(Math.min(Math.abs(s.a[0] - s.b[0]), Math.abs(s.a[1] - s.b[1]))).toBeLessThan(0.01)
    const hid = l.segs.filter(s => s.hidden)
    for (let i = 0; i < hid.length; i++) for (let j = i + 1; j < hid.length; j++) {
      const a = hid[i], b = hid[j]
      const level = Math.abs(a.a[1] - a.b[1]) < 1e-3 && Math.abs(b.a[1] - b.b[1]) < 1e-3 && Math.abs(a.a[1] - b.a[1]) < 1e-3
      if (!level) continue
      const overlap = Math.min(Math.max(a.a[0], a.b[0]), Math.max(b.a[0], b.b[0])) - Math.max(Math.min(a.a[0], a.b[0]), Math.min(b.a[0], b.b[0]))
      expect(overlap).toBeLessThan(1e-3)
    }
  }
}, 60000)
