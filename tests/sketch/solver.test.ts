import { initSolver, solveSketch } from '../../src/sketch/solver'
import { newSketch, type Sketch, type SketchConstraint } from '../../src/sketch/types'

beforeAll(async () => { await initSolver() })

function rough(extra: SketchConstraint[] = []): Sketch {
  const s = newSketch('k', 'R', 'precise')
  s.points = [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 9.3, y: 0.4 }, { id: 'c', x: 9.8, y: 4.6 }, { id: 'd', x: 0.2, y: 3.7 }]
  s.entities = [
    { id: 'l1', kind: 'line', a: 'a', b: 'b' }, { id: 'l2', kind: 'line', a: 'b', b: 'c' },
    { id: 'l3', kind: 'line', a: 'c', b: 'd' }, { id: 'l4', kind: 'line', a: 'd', b: 'a' }
  ]
  s.constraints = [
    { id: 'h1', kind: 'horizontal', refs: ['l1'] }, { id: 'h2', kind: 'horizontal', refs: ['l3'] },
    { id: 'v1', kind: 'vertical', refs: ['l2'] }, { id: 'v2', kind: 'vertical', refs: ['l4'] },
    { id: 'fx', kind: 'fixed', refs: ['a'] },
    { id: 'w', kind: 'distance', refs: ['l1'], value: 10 }, { id: 'h', kind: 'distance', refs: ['l2'], value: 4 },
    ...extra
  ]
  return s
}
const pt = (s: Sketch, id: string) => s.points.find(p => p.id === id)!

test('a rough rectangle with its rules and two dimensions solves to exactly 10 × 4, fully fixed', () => {
  const t = performance.now()
  const r = solveSketch(rough())
  const ms = performance.now() - t
  expect(r.status).toBe('ok')
  expect(r.dof).toBe(0)
  expect(pt(r.sketch, 'a')).toMatchObject({ x: 0, y: 0 })
  expect(pt(r.sketch, 'c').x).toBeCloseTo(10, 9)
  expect(pt(r.sketch, 'c').y).toBeCloseTo(4, 9)
  expect(ms).toBeLessThan(250)
})

test('without the height it still solves, with one way left to move', () => {
  const s = rough()
  s.constraints = s.constraints.filter(c => c.id !== 'h')
  const r = solveSketch(s)
  expect(r.status).toBe('ok')
  expect(r.dof).toBe(1)
  expect(pt(r.sketch, 'b').x).toBeCloseTo(10, 9)
})

test('two different lengths for one edge conflict; both are named and nothing moves', () => {
  const s = rough([{ id: 'w2', kind: 'distance', refs: ['l1'], value: 12 }])
  const r = solveSketch(s)
  expect(r.status).toBe('conflict')
  expect(r.conflicting).toEqual(expect.arrayContaining(['w', 'w2']))
  expect(r.sketch.points).toEqual(s.points)
})

test('a circle with a 3" diameter gets a 1-1/2" radius', () => {
  const s = newSketch('k', 'C', 'precise')
  s.points = [{ id: 'c', x: 1, y: 1 }]
  s.entities = [{ id: 'o', kind: 'circle', center: 'c', r: 2.2 }]
  s.constraints = [{ id: 'd', kind: 'diameter', refs: ['o'], value: 3 }]
  const r = solveSketch(s)
  expect(r.status).toBe('ok')
  const o = r.sketch.entities[0]
  expect(o.kind === 'circle' && o.r).toBeCloseTo(1.5, 9)
})

test('a line made tangent to an arc touches it', () => {
  const s = newSketch('k', 'T', 'precise')
  s.points = [{ id: 'c', x: 0, y: 0 }, { id: 's', x: 2, y: 0 }, { id: 'e', x: 0, y: 2 }, { id: 'p', x: -3, y: 2.4 }, { id: 'q', x: 3, y: 2.3 }]
  s.entities = [{ id: 'arc', kind: 'arc', center: 'c', start: 's', end: 'e' }, { id: 'ln', kind: 'line', a: 'p', b: 'q' }]
  s.constraints = [{ id: 'f', kind: 'fixed', refs: ['c'] }, { id: 'r', kind: 'radius', refs: ['arc'], value: 2 }, { id: 't', kind: 'tangent', refs: ['ln', 'arc'] }, { id: 'hz', kind: 'horizontal', refs: ['ln'] }]
  const r = solveSketch(s)
  expect(r.status).toBe('ok')
  expect(pt(r.sketch, 'p').y).toBeCloseTo(2, 6)
  expect(pt(r.sketch, 'q').y).toBeCloseTo(2, 6)
})

test('horizontal and vertical dimensions measure along x and y', () => {
  const s = newSketch('k', 'HV', 'precise')
  s.points = [{ id: 'a', x: 0, y: 0, fixed: true }, { id: 'b', x: 5.2, y: 1.1 }]
  s.entities = [{ id: 'l', kind: 'line', a: 'a', b: 'b' }]
  s.constraints = [{ id: 'hx', kind: 'hdistance', refs: ['a', 'b'], value: 6 }, { id: 'vy', kind: 'vdistance', refs: ['l'], value: 2 }]
  const r = solveSketch(s)
  expect(pt(r.sketch, 'b').x).toBeCloseTo(6, 9)
  expect(pt(r.sketch, 'b').y).toBeCloseTo(2, 9)
})

test('an angle between two lines is in degrees', () => {
  const s = newSketch('k', 'A', 'precise')
  s.points = [{ id: 'o', x: 0, y: 0, fixed: true }, { id: 'x', x: 4, y: 0, fixed: true }, { id: 'y', x: 3, y: 2.5 }]
  s.entities = [{ id: 'l1', kind: 'line', a: 'o', b: 'x' }, { id: 'l2', kind: 'line', a: 'o', b: 'y' }]
  s.constraints = [{ id: 'an', kind: 'angle', refs: ['l1', 'l2'], value: 45 }, { id: 'len', kind: 'distance', refs: ['l2'], value: 2 }]
  const r = solveSketch(s)
  expect(r.status).toBe('ok')
  expect(pt(r.sketch, 'y').x).toBeCloseTo(Math.SQRT2, 6)
  expect(pt(r.sketch, 'y').y).toBeCloseTo(Math.SQRT2, 6)
})
