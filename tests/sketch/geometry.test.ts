import { bounds, findLoops, loopPolygon, outlineFromSketch, polygonArea, selfCrossing, tessellate } from '../../src/sketch/geometry'
import { newSketch, type Sketch } from '../../src/sketch/types'
import { apron } from './fixtures'

const rect = (s: Sketch, pre: string, x0: number, y0: number, x1: number, y1: number) => {
  s.points.push({ id: `${pre}1`, x: x0, y: y0 }, { id: `${pre}2`, x: x1, y: y0 }, { id: `${pre}3`, x: x1, y: y1 }, { id: `${pre}4`, x: x0, y: y1 })
  for (let i = 1; i <= 4; i++) s.entities.push({ id: `${pre}e${i}`, kind: 'line', a: `${pre}${i}`, b: `${pre}${(i % 4) + 1}` })
}

test('the arched apron is one closed loop with the right area and size', () => {
  const s = apron()
  const { closed, gaps } = findLoops(s)
  expect(gaps).toEqual([])
  expect(closed).toHaveLength(1)
  const poly = loopPolygon(s, closed[0])
  const R = 57.25
  const half = Math.asin(15 / R)
  const segment = (R * R * (2 * half - Math.sin(2 * half))) / 2
  expect(Math.abs(polygonArea(poly) - (120 - segment)) / (120 - segment)).toBeLessThan(0.005)
  const b = bounds([poly])
  expect(b.maxX - b.minX).toBeCloseTo(30, 3)
  expect(b.maxY - b.minY).toBeCloseTo(4, 3)
  expect(selfCrossing(poly)).toBeNull()
})

test('an arc is drawn counter-clockwise from start to end, through its middle', () => {
  const pts = tessellate(apron(), 'e4')
  const mid = pts[Math.floor(pts.length / 2)]
  expect(mid.x).toBeCloseTo(15, 1)
  expect(mid.y).toBeCloseTo(2, 2)
})

test('an open outline reports a gap at the open end', () => {
  const s = newSketch('k', 'L', 'precise')
  s.points = [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 10, y: 0 }, { id: 'c', x: 10, y: 5 }]
  s.entities = [{ id: 'e1', kind: 'line', a: 'a', b: 'b' }, { id: 'e2', kind: 'line', a: 'b', b: 'c' }]
  const r = outlineFromSketch(s)
  expect('error' in r && r.error).toBe('This outline has a gap — close it to make a part')
  const at = 'error' in r ? r.at! : null
  expect([[0, 0], [10, 5]]).toContainEqual([at!.x, at!.y])
})

test('ends within 1/64" count as joined', () => {
  const s = newSketch('k', 'T', 'precise')
  s.points = [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 4, y: 0 }, { id: 'c', x: 0, y: 3 }, { id: 'a2', x: 0.01, y: 0 }]
  s.entities = [{ id: 'e1', kind: 'line', a: 'a', b: 'b' }, { id: 'e2', kind: 'line', a: 'b', b: 'c' }, { id: 'e3', kind: 'line', a: 'c', b: 'a2' }]
  expect(findLoops(s).closed).toHaveLength(1)
})

test('a bow-tie crosses itself in the middle', () => {
  const s = newSketch('k', 'Bow', 'precise')
  s.points = [{ id: 'a', x: -2, y: -1 }, { id: 'b', x: 2, y: 1 }, { id: 'c', x: 2, y: -1 }, { id: 'd', x: -2, y: 1 }]
  s.entities = [
    { id: 'e1', kind: 'line', a: 'a', b: 'b' }, { id: 'e2', kind: 'line', a: 'b', b: 'c' },
    { id: 'e3', kind: 'line', a: 'c', b: 'd' }, { id: 'e4', kind: 'line', a: 'd', b: 'a' }
  ]
  const r = outlineFromSketch(s)
  expect('error' in r && r.error).toBe('The outline crosses itself here.')
  const at = 'error' in r ? r.at! : null
  expect(at!.x).toBeCloseTo(0, 6)
  expect(at!.y).toBeCloseTo(0, 6)
})

test('a loop inside the outline is a cutout, a circle inside is a hole, construction lines are ignored', () => {
  const s = newSketch('k', 'Plate', 'precise')
  rect(s, 'o', 0, 0, 10, 8)
  rect(s, 'i', 2, 2, 5, 5)
  s.points.push({ id: 'cc', x: 7.5, y: 6 }, { id: 'x1', x: -3, y: -3 }, { id: 'x2', x: 20, y: 20 })
  s.entities.push({ id: 'circ', kind: 'circle', center: 'cc', r: 0.5 })
  s.entities.push({ id: 'cl', kind: 'line', a: 'x1', b: 'x2', construction: true })
  const r = outlineFromSketch(s)
  if ('error' in r) throw new Error(r.error)
  expect(r.outline.outer.sort()).toEqual(['oe1', 'oe2', 'oe3', 'oe4'])
  expect(r.outline.holes).toHaveLength(1)
  expect(r.outline.holes[0].sort()).toEqual(['ie1', 'ie2', 'ie3', 'ie4'])
  expect(r.outline.circles).toEqual(['circ'])
  expect(polygonArea(r.outer)).toBeCloseTo(80, 6)
  expect(r.holes).toHaveLength(2)
})

test('a lone circle can be the whole outline (a coaster)', () => {
  const s = newSketch('k', 'Coaster', 'precise')
  s.points = [{ id: 'c', x: 0, y: 0 }]
  s.entities = [{ id: 'circ', kind: 'circle', center: 'c', r: 2 }]
  const r = outlineFromSketch(s)
  if ('error' in r) throw new Error(r.error)
  expect(r.outline.outer).toEqual(['circ'])
  expect(Math.abs(polygonArea(r.outer) - Math.PI * 4) / (Math.PI * 4)).toBeLessThan(0.002)
})

test('a spline passes through its points', () => {
  const s = newSketch('k', 'S', 'freehand')
  s.points = [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 2, y: 1 }, { id: 'c', x: 4, y: 0 }]
  s.entities = [{ id: 'sp', kind: 'spline', points: ['a', 'b', 'c'] }]
  const pts = tessellate(s, 'sp')
  expect(pts[0]).toEqual({ x: 0, y: 0 })
  expect(pts.at(-1)).toEqual({ x: 4, y: 0 })
  expect(pts.some(p => Math.abs(p.x - 2) < 1e-9 && Math.abs(p.y - 1) < 1e-9)).toBe(true)
})

test('an empty drawing says what to do', () => {
  const r = outlineFromSketch(newSketch('k', 'E', 'precise'))
  expect('error' in r && r.error).toMatch(/draw a closed shape/i)
})
