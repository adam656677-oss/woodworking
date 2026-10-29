import { extend, fillet, chamfer, isModifyError, mirror, offset, trim, type ModifyResult } from '../../src/sketch/modify'
import { bounds, outlineFromSketch, tessellateEntity } from '../../src/sketch/geometry'
import { snapTo } from '../../src/sketch/snap'
import { newSketch, type Sketch } from '../../src/sketch/types'

function rect(w = 10, h = 4): Sketch {
  const s = newSketch('k', 'R', 'precise')
  s.points = [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: w, y: 0 }, { id: 'c', x: w, y: h }, { id: 'd', x: 0, y: h }]
  s.entities = [
    { id: 'l1', kind: 'line', a: 'a', b: 'b' }, { id: 'l2', kind: 'line', a: 'b', b: 'c' },
    { id: 'l3', kind: 'line', a: 'c', b: 'd' }, { id: 'l4', kind: 'line', a: 'd', b: 'a' }
  ]
  return s
}
const ok = (r: ModifyResult): Sketch => { if (isModifyError(r)) throw new Error(r.error); return r }
const P = (s: Sketch, id: string) => s.points.find(p => p.id === id)!
const lineLen = (s: Sketch, id: string) => { const e = s.entities.find(x => x.id === id)!; const [a, b] = tessellateEntity(s, e); return Math.hypot(b.x - a.x, b.y - a.y) }

test('a 1" fillet shortens both lines by 1" and joins them with a tangent arc', () => {
  const s = ok(fillet(rect(), 'b', 1))
  expect(lineLen(s, 'l1')).toBeCloseTo(9, 9)
  expect(lineLen(s, 'l2')).toBeCloseTo(3, 9)
  const arc = s.entities.find(e => e.kind === 'arc')!
  expect(arc.kind === 'arc' && P(s, arc.center)).toMatchObject({ x: 9, y: 1 })
  expect(s.constraints.filter(c => c.kind === 'tangent')).toHaveLength(2)
  expect(s.points.find(p => p.id === 'b')).toBeUndefined()
  expect('error' in outlineFromSketch(s)).toBe(false)
})

test('a fillet too big for the lines says so', () => {
  expect(fillet(rect(10, 4), 'b', 5)).toEqual({ error: 'That radius is too big for these lines' })
  expect(fillet(rect(), 'nope', 1)).toEqual({ error: 'Pick a corner where two straight lines meet' })
})

test('a chamfer cuts the corner off straight', () => {
  const s = ok(chamfer(rect(), 'c', 1))
  expect(s.entities).toHaveLength(5)
  expect(lineLen(s, 'l2')).toBeCloseTo(3, 9)
})

test('offsetting a closed 10 × 4 rectangle 1/2" outward makes 11 × 5, whichever way it was drawn', () => {
  for (const s0 of [rect(), { ...rect(), entities: rect().entities.map(e => (e.kind === 'line' ? { ...e, a: e.b, b: e.a } : e)) }]) {
    const s = ok(offset(s0, ['l1', 'l2', 'l3', 'l4'], 0.5))
    const added = s.entities.slice(4)
    expect(added).toHaveLength(4)
    const b = bounds(added.map(e => tessellateEntity(s, e)))
    expect(b.maxX - b.minX).toBeCloseTo(11, 9)
    expect(b.maxY - b.minY).toBeCloseTo(5, 9)
  }
})

test('offsetting a rounded corner keeps it rounded and joined', () => {
  const r = ok(fillet(rect(), 'b', 1))
  const ids = r.entities.map(e => e.id)
  const s = ok(offset(r, ids, 0.5))
  const added = s.entities.slice(r.entities.length)
  const arc = added.find(e => e.kind === 'arc')!
  expect(arc.kind === 'arc' && Math.hypot(P(s, arc.start).x - 9, P(s, arc.start).y - 1)).toBeCloseTo(1.5, 9)
  const only = { ...s, entities: added, constraints: [] }
  expect('error' in outlineFromSketch(only)).toBe(false)
})

test('trim removes the piece of a line on the clicked side of a crossing', () => {
  const s = newSketch('k', 'X', 'precise')
  s.points = [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 10, y: 0 }, { id: 'c', x: 4, y: -2 }, { id: 'd', x: 4, y: 2 }]
  s.entities = [{ id: 'h', kind: 'line', a: 'a', b: 'b' }, { id: 'v', kind: 'line', a: 'c', b: 'd' }]
  const t = ok(trim(s, 'h', { x: 8, y: 0 }))
  const h = t.entities.find(e => e.id === 'h')!
  const [p, q] = tessellateEntity(t, h)
  expect([p.x, q.x].sort((x, y) => x - y)).toEqual([0, 4])
  expect(t.points.find(x => x.id === 'b')).toBeUndefined()
  // With nothing crossing it, trim deletes the line.
  const lone = ok(trim(t, 'v', { x: 4, y: 1 }))
  expect(lone.entities.find(e => e.id === 'v')).toBeDefined()
  const gone = ok(trim({ ...s, entities: [s.entities[0]] }, 'h', { x: 5, y: 0 }))
  expect(gone.entities).toEqual([])
})

test('trim in the middle splits the line in two', () => {
  const s = newSketch('k', 'X', 'precise')
  s.points = [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 10, y: 0 }, { id: 'c', x: 3, y: -2 }, { id: 'd', x: 3, y: 2 }, { id: 'e', x: 7, y: -2 }, { id: 'f', x: 7, y: 2 }]
  s.entities = [{ id: 'h', kind: 'line', a: 'a', b: 'b' }, { id: 'v1', kind: 'line', a: 'c', b: 'd' }, { id: 'v2', kind: 'line', a: 'e', b: 'f' }]
  const t = ok(trim(s, 'h', { x: 5, y: 0.1 }))
  expect(t.entities.filter(e => e.kind === 'line')).toHaveLength(4)
})

test('extend runs a line on until it meets another', () => {
  const s = newSketch('k', 'E', 'precise')
  s.points = [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 3, y: 0 }, { id: 'c', x: 6, y: -2 }, { id: 'd', x: 6, y: 2 }]
  s.entities = [{ id: 'h', kind: 'line', a: 'a', b: 'b' }, { id: 'v', kind: 'line', a: 'c', b: 'd' }]
  const t = ok(extend(s, 'h', 'v'))
  expect(P(t, 'b')).toMatchObject({ x: 6, y: 0 })
})

test('mirror across a construction line makes a matching copy held symmetric', () => {
  const s = newSketch('k', 'M', 'precise')
  s.points = [{ id: 'a', x: 1, y: 0 }, { id: 'b', x: 3, y: 2 }, { id: 'm1', x: 0, y: -5 }, { id: 'm2', x: 0, y: 5 }]
  s.entities = [{ id: 'l', kind: 'line', a: 'a', b: 'b' }, { id: 'axis', kind: 'line', a: 'm1', b: 'm2', construction: true }]
  const t = ok(mirror(s, ['l'], 'axis'))
  const copy = t.entities[2]
  expect(copy.kind).toBe('line')
  const [p, q] = tessellateEntity(t, copy)
  expect(p).toMatchObject({ x: -1, y: 0 })
  expect(q).toMatchObject({ x: -3, y: 2 })
  expect(t.constraints.filter(c => c.kind === 'symmetric')).toHaveLength(2)
})

test('snapping prefers a nearby end point over the grid', () => {
  const s = rect()
  const r = snapTo(s, { x: 10.05, y: 0.04 }, { tol: 0.2 })
  expect(r).toMatchObject({ kind: 'endpoint', ref: 'b', pt: { x: 10, y: 0 } })
  expect(snapTo(s, { x: 5.02, y: 0.03 }, { tol: 0.2 })).toMatchObject({ kind: 'midpoint', pt: { x: 5, y: 0 } })
  expect(snapTo(s, { x: 3.1, y: 2.05 }, { tol: 0.2, grid: 1 / 8 })).toMatchObject({ kind: 'grid', pt: { x: 3.125, y: 2 } })
})

test('snapping finds crossings, circle centres and tangent points', () => {
  const s = newSketch('k', 'S', 'precise')
  s.points = [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 10, y: 0 }, { id: 'c', x: 4, y: -2 }, { id: 'd', x: 4, y: 3 }, { id: 'o', x: 20, y: 0 }]
  s.entities = [{ id: 'h', kind: 'line', a: 'a', b: 'b' }, { id: 'v', kind: 'line', a: 'c', b: 'd' }, { id: 'ci', kind: 'circle', center: 'o', r: 2 }]
  expect(snapTo(s, { x: 4.05, y: 0.05 }, { tol: 0.2 })).toMatchObject({ kind: 'intersection', pt: { x: 4, y: 0 } })
  expect(snapTo(s, { x: 20.1, y: 0.1 }, { tol: 0.2 })).toMatchObject({ kind: 'center', ref: 'o' })
  // From (20, 6) the tangent touches the circle at y = 2/3.
  const t = snapTo(s, { x: 21.9, y: 0.7 }, { tol: 0.2, from: { x: 20, y: 6 } })
  expect(t.kind).toBe('tangent')
  expect(t.pt.y).toBeCloseTo(2 / 3, 6)
})
