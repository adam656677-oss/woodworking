import { deserialize, serialize } from '../../src/model/fileFormat'
import { addBoard, changeWood } from '../../src/model/ops'
import { addSketch, outlinePolygons, shapeBoard, updateSketch } from '../../src/model/shaped'
import { validate } from '../../src/model/validate'
import { emptyProject } from '../../src/model/woods'
import { createDrawStore } from '../../src/sketch/drawStore'
import { toDxf } from '../../src/sketch/dxf'
import { outlineFromSketch } from '../../src/sketch/geometry'
import { initSolver } from '../../src/sketch/solver'
import { newSketch } from '../../src/sketch/types'
import { apron } from './fixtures'

beforeAll(async () => { await initSolver() })

function shaped() {
  const r = shapeBoard(addSketch(emptyProject('T'), apron()), null, 'k1', '1x6')
  if ('error' in r) throw new Error(r.error)
  return r
}

test('a shaped part whose drawing is opened up still saves and reopens; it shows as a rectangle with a warning until closed again', () => {
  const { project, id } = shaped()
  const open = apron()
  open.entities = open.entities.filter(e => e.id !== 'e4')
  const p = updateSketch(project, open)
  const back = deserialize(serialize(p))
  const b = back.boards.find(x => x.id === id)!
  expect(b.outline?.sketchId).toBe('k1')
  expect(outlinePolygons(back, b)).toBeNull()
  expect(validate(back).map(w => w.message)).toContain("Apron's drawing isn't a closed shape — it shows as a plain rectangle until it is")
  // Closing it again brings the shape back.
  const again = updateSketch(back, apron())
  expect(outlinePolygons(again, again.boards[0])).not.toBeNull()
})

test('a file whose shaped part points at a missing drawing opens, with that part as a rectangle', () => {
  const { project } = shaped()
  const raw = JSON.parse(serialize(project))
  raw.sketches = []
  const p = deserialize(JSON.stringify(raw))
  expect(p.boards[0].outline).toBeUndefined()
  expect(p.boards[0]).toMatchObject({ width: 4, length: 30 })
})

test('dragging a point leaves no hidden rule behind', () => {
  const s = createDrawStore()
  s.getState().begin(newSketch('k', 'R', 'precise'))
  s.getState().addRect({ x: 0, y: 0 }, { x: 10, y: 4 })
  const far = s.getState().sketch.points[1].id
  s.getState().dragPoint(far, { x: 12, y: 5 })
  s.getState().endDrag()
  expect(s.getState().sketch.constraints.map(c => c.kind).sort()).toEqual(['horizontal', 'horizontal', 'vertical', 'vertical'])
})

test('an angle dimension measures the opening between the lines and moves nothing', () => {
  const s = createDrawStore()
  const sk = newSketch('k', 'V', 'precise')
  sk.points = [{ id: 'o', x: 0, y: 0 }, { id: 'a', x: 4, y: 0 }, { id: 'b', x: -3, y: -3 }]
  sk.entities = [{ id: 'l1', kind: 'line', a: 'o', b: 'a' }, { id: 'l2', kind: 'line', a: 'o', b: 'b' }]
  s.getState().begin(sk)
  const id = s.getState().addConstraint('angle', ['l1', 'l2'])!
  const c = s.getState().sketch.constraints.find(x => x.id === id)!
  expect(c.value).toBeCloseTo(135, 6)
  const pts = s.getState().sketch.points
  expect(pts.find(p => p.id === 'a')!.x).toBeCloseTo(4, 6)
  expect(pts.find(p => p.id === 'b')!.x).toBeCloseTo(-3, 6)
  expect(pts.find(p => p.id === 'b')!.y).toBeCloseTo(-3, 6)
})

test('Edit shape on a board wider than it is long keeps its width and length', () => {
  const r0 = addBoard(emptyProject('T'), { woodId: 'ply-3-4', name: 'Panel', width: 12, length: 10 })
  // The drawing Edit shape starts with: the board's length across, its width up.
  const sk = newSketch('k9', 'Panel shape', 'precise')
  sk.points = [{ id: 'p1', x: 0, y: 0 }, { id: 'p2', x: 10, y: 0 }, { id: 'p3', x: 10, y: 12 }, { id: 'p4', x: 0, y: 12 }]
  sk.entities = [1, 2, 3, 4].map(i => ({ id: `e${i}`, kind: 'line' as const, a: `p${i}`, b: `p${(i % 4) + 1}` }))
  const r = shapeBoard(addSketch(r0.project, sk), r0.id, 'k9')
  if ('error' in r) throw new Error(r.error)
  expect(r.project.boards[0]).toMatchObject({ width: 12, length: 10 })
})

test('changing the wood of a full-width shaped part keeps its drawn size', () => {
  const sk = apron()
  sk.points = sk.points.map(p => (p.y === 4 ? { ...p, y: 5.5 } : p))
  const r = shapeBoard(addSketch(emptyProject('T'), sk), null, 'k1', '1x6')
  if ('error' in r) throw new Error(r.error)
  expect(r.project.boards[0].width).toBe(5.5)
  expect(changeWood(r.project, r.id, '1x8').boards[0].width).toBe(5.5)
})

test('three lines meeting at one point gets its own message, not "gap"', () => {
  const sk = apron()
  sk.points.push({ id: 'm', x: 15, y: 8 })
  sk.entities.push({ id: 'x', kind: 'line', a: 'p2', b: 'm' })
  sk.points.push({ id: 'm2', x: 0, y: 8 })
  sk.entities.push({ id: 'y', kind: 'line', a: 'm', b: 'm2' }, { id: 'z', kind: 'line', a: 'm2', b: 'p2' })
  const r = outlineFromSketch(sk)
  expect('error' in r && r.error).toBe('Three or more lines meet here — an outline must be one closed path.')
})

test('DXF polylines carry the dummy point strict R12 readers expect', () => {
  const sk = newSketch('k', 'S', 'freehand')
  sk.points = [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 2, y: 1 }, { id: 'c', x: 4, y: 0 }]
  sk.entities = [{ id: 's', kind: 'spline', points: ['a', 'b', 'c'] }]
  expect(toDxf(sk)).toContain('0\nPOLYLINE\n8\nOUTLINE\n66\n1\n10\n0\n20\n0\n30\n0\n70\n0\n')
})
