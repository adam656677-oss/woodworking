import { createDrawStore, CONFLICT_MESSAGE } from '../../src/sketch/drawStore'
import { initSolver } from '../../src/sketch/solver'
import { fillet } from '../../src/sketch/modify'
import { newSketch } from '../../src/sketch/types'

beforeAll(async () => { await initSolver() })

function board() {
  const s = createDrawStore()
  s.getState().begin(newSketch('k1', 'Shelf end', 'precise'), { isNew: true })
  return s
}
const pt = (s: ReturnType<typeof board>, id: string) => s.getState().sketch.points.find(p => p.id === id)!

test('a rectangle with its width and height and a fixed corner is fully fixed', () => {
  const s = board()
  const [bottom, right] = s.getState().addRect({ x: 0, y: 0 }, { x: 9.5, y: 3.8 })
  expect(s.getState().sketch.constraints).toHaveLength(4)
  const corner = s.getState().sketch.points[0].id
  s.getState().addConstraint('distance', [bottom], 10)
  s.getState().addConstraint('distance', [right], 4)
  s.getState().addConstraint('fixed', [corner])
  expect(s.getState().solve).toMatchObject({ status: 'ok', dof: 0 })
  const [a, c] = s.getState().sketch.points // first corner, opposite corner
  expect(c.x - a.x).toBeCloseTo(10, 9)
  expect(c.y - a.y).toBeCloseTo(4, 9)
})

test('typing a new size for a dimension resizes the shape; undo puts it back', () => {
  const s = board()
  const [bottom] = s.getState().addRect({ x: 0, y: 0 }, { x: 10, y: 4 })
  s.getState().addConstraint('fixed', [s.getState().sketch.points[0].id])
  const w = s.getState().addConstraint('distance', [bottom])!
  expect(s.getState().sketch.constraints.find(c => c.id === w)!.value).toBeCloseTo(10, 9)
  expect(s.getState().setDimension(w, 12)).toBe(true)
  expect(s.getState().sketch.points[1].x).toBeCloseTo(12, 9)
  s.getState().undo()
  expect(s.getState().sketch.points[1].x).toBeCloseTo(10, 9)
})

test('a dimension that disagrees is shown as a conflict, named, and nothing moves', () => {
  const s = board()
  const [bottom] = s.getState().addRect({ x: 0, y: 0 }, { x: 10, y: 4 })
  s.getState().addConstraint('fixed', [s.getState().sketch.points[0].id])
  s.getState().addConstraint('distance', [bottom], 10)
  const before = s.getState().sketch.points
  s.getState().addConstraint('hdistance', [bottom], 12)
  expect(s.getState().solve.status).toBe('conflict')
  expect(s.getState().message).toContain(CONFLICT_MESSAGE)
  expect(s.getState().message).toContain('Length 10"')
  expect(s.getState().message).toContain('Width 12"')
  expect(s.getState().sketch.points).toEqual(before)
  // Removing one of them clears it.
  const bad = s.getState().solve.conflicting.find(id => s.getState().sketch.constraints.find(c => c.id === id)?.kind === 'hdistance')!
  s.getState().remove([bad])
  expect(s.getState().solve.status).toBe('ok')
})

test('typing a size that can\'t be met leaves the drawing as it was', () => {
  const s = board()
  const [bottom, right] = s.getState().addRect({ x: 0, y: 0 }, { x: 10, y: 4 })
  s.getState().addConstraint('fixed', [s.getState().sketch.points[0].id])
  s.getState().addConstraint('equal', [bottom, right])
  const w = s.getState().addConstraint('distance', [bottom])!
  const h = s.getState().addConstraint('distance', [right])
  expect(h).not.toBeNull()
  // Now the square is fully held; asking for a different height conflicts with "equal".
  const before = s.getState().sketch
  const ok = s.getState().setDimension(h!, 6)
  expect(ok).toBe(false)
  expect(s.getState().sketch.points).toEqual(before.points)
  expect(s.getState().message).toContain(CONFLICT_MESSAGE)
  expect(w).toBeTruthy()
})

test('lines drawn from a snapped end share the point', () => {
  const s = board()
  s.getState().addLine({ x: 0, y: 0 }, { x: 5, y: 0 })
  const sn = s.getState().snap({ x: 5.03, y: 0.02 }, 0.2)
  expect(sn.kind).toBe('endpoint')
  s.getState().addLine({ ...sn.pt, ref: sn.ref }, { x: 5, y: 3 })
  expect(s.getState().sketch.points).toHaveLength(3)
})

test('a three-point arc goes through its middle point', () => {
  const s = board()
  const id = s.getState().addArc3({ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 2, y: -2 })!
  const arc = s.getState().sketch.entities.find(e => e.id === id)!
  expect(arc.kind).toBe('arc')
  const c = arc.kind === 'arc' ? pt(s, arc.center) : null
  expect(c!.x).toBeCloseTo(2, 9)
  expect(c!.y).toBeCloseTo(0, 9)
  // Counter-clockwise from start to end must pass below (through y = -2): start is the left end.
  expect(arc.kind === 'arc' && pt(s, arc.start)).toMatchObject({ x: 0, y: 0 })
})

test('dragging a point keeps its rules; the drag is one undo step', () => {
  const s = board()
  s.getState().addRect({ x: 0, y: 0 }, { x: 10, y: 4 })
  // Points: [0] first corner, [1] opposite corner (10, 4), [2] bottom right, [3] top left.
  const far = s.getState().sketch.points[1].id
  s.getState().dragPoint(far, { x: 12, y: 5 })
  s.getState().dragPoint(far, { x: 13, y: 6 })
  s.getState().endDrag()
  const pts = s.getState().sketch.points
  expect(pts[1].x).toBeCloseTo(13, 6)
  expect(pts[2].y).toBeCloseTo(pts[0].y, 9) // bottom still level
  expect(pts[2].x).toBeCloseTo(pts[1].x, 9) // right side still upright
  s.getState().undo()
  expect(s.getState().sketch.points[1]).toMatchObject({ x: 10, y: 4 })
})

test('fillet through the store; an impossible one explains itself', () => {
  const s = board()
  s.getState().addRect({ x: 0, y: 0 }, { x: 10, y: 4 })
  const corner = s.getState().sketch.points[1].id
  expect(s.getState().modify(sk => fillet(sk, corner, 9))).toBe(false)
  expect(s.getState().message).toBe('That radius is too big for these lines')
  expect(s.getState().modify(sk => fillet(sk, corner, 1))).toBe(true)
  expect(s.getState().sketch.entities.some(e => e.kind === 'arc')).toBe(true)
})

test('removing a point removes the shapes on it', () => {
  const s = board()
  s.getState().addLine({ x: 0, y: 0 }, { x: 5, y: 0 })
  const p = s.getState().sketch.points[1].id
  s.getState().remove([p])
  expect(s.getState().sketch.entities).toEqual([])
  expect(s.getState().sketch.points).toEqual([])
})
