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
