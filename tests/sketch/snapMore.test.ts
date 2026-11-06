import { snapTo } from '../../src/sketch/snap'
import { sketchSnapLabel } from '../../src/sketch/snapFeedback'
import { newSketch } from '../../src/sketch/types'

function lineSketch() {
  const s = newSketch('k', 'S', 'precise')
  s.points = [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 10, y: 0 }, { id: 'o', x: 20, y: 0 }]
  s.entities = [{ id: 'h', kind: 'line', a: 'a', b: 'b' }, { id: 'ci', kind: 'circle', center: 'o', r: 2 }]
  return s
}

test('quadrants: the top, bottom, left and right of a circle', () => {
  const s = lineSketch()
  expect(snapTo(s, { x: 20.05, y: 2.06 }, { tol: 0.2 })).toMatchObject({ kind: 'quadrant', pt: { x: 20, y: 2 } })
  expect(snapTo(s, { x: 17.95, y: 0.05 }, { tol: 0.2 }).pt.x).toBeCloseTo(18, 9)
})

test('perpendicular: from the start point, square onto a line', () => {
  const s = lineSketch()
  const r = snapTo(s, { x: 3.1, y: 0.1 }, { tol: 0.2, from: { x: 3, y: 5 } })
  expect(r).toMatchObject({ kind: 'perpendicular', pt: { x: 3, y: 0 } })
  expect(sketchSnapLabel(r, 0.125)).toBe('Perpendicular')
})

test('on the shape: a point on a line, only when very close, so the grid still works in open space', () => {
  const s = lineSketch()
  expect(snapTo(s, { x: 6.37, y: 0.04 }, { tol: 0.2, grid: 0.5 })).toMatchObject({ kind: 'nearest', pt: { x: 6.37, y: 0 } })
  expect(snapTo(s, { x: 6.37, y: 0.4 }, { tol: 0.2, grid: 0.5 }).kind).toBe('grid')
})

test('15° angle steps lock a line being drawn, to 1/64" along the step', () => {
  const s = newSketch('k', 'S', 'precise')
  const r = snapTo(s, { x: 7.03, y: 7.1 }, { tol: 0.2, from: { x: 0, y: 0 }, grid: 0.125 })
  expect(r.kind).toBe('angle')
  expect(r.angle).toBe(45)
  expect(Math.atan2(r.pt.y, r.pt.x) * 180 / Math.PI).toBeCloseTo(45, 9)
  expect(sketchSnapLabel(r, 0.125)).toBe('45°')
  // A grid point already on the step stays a grid snap; far off a step, it's the grid.
  expect(snapTo(s, { x: 5.01, y: 0.02 }, { tol: 0.2, from: { x: 0, y: 0 }, grid: 0.125 })).toMatchObject({ kind: 'grid', pt: { x: 5, y: 0 } })
  expect(snapTo(s, { x: 5, y: 2.2 }, { tol: 0.2, from: { x: 0, y: 0 }, grid: 0.125 }).kind).toBe('grid')
})
