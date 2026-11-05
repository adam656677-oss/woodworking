import { snapPosition } from '../../src/model/snap'
import { board, project } from './helpers'

const opts = { tolerance: 0.25, grid: 1 / 16 }

test('a face 0.1" from another face snaps onto it', () => {
  const a = board({ id: 'a', width: 4, length: 10 })
  const b = board({ id: 'b', width: 4, length: 10, position: { x: 30, y: 0, z: 0 } })
  const r = snapPosition(project([a, b]), 'b', { x: 4.1, y: 0, z: 0 }, opts)
  expect(r.position.x).toBe(4)
  expect(r.snaps).toContain('face')
})

test('with nothing nearby the corner rounds to the 1/16 grid', () => {
  const b = board({ id: 'b', width: 4, length: 10 })
  const r = snapPosition(project([b]), 'b', { x: 3.04, y: 0, z: 0 }, opts)
  expect(r.position.x).toBe(3.0625)
  expect(r.snaps).toEqual(['grid', 'grid', 'grid'])
})

test('snapping works for rotated boards by their world box', () => {
  const a = board({ id: 'a', width: 4, length: 10 })
  const side = board({ id: 's', thickness: 0.75, width: 10, length: 36, rotation: { x: 90, y: 90, z: 0 } })
  const r = snapPosition(project([a, side]), 's', { x: 4.2, y: 0, z: 0 }, opts)
  expect(r.position.x).toBe(4)
})

test('each axis reports what it snapped to', () => {
  const a = board({ id: 'a', width: 4, length: 10 })
  const b = board({ id: 'b', width: 4, length: 8, position: { x: 30, y: 0, z: 0 } })
  const r = snapPosition(project([a, b]), 'b', { x: 4.1, y: 0.01, z: 0 }, opts)
  const x = r.hits.find(h => h.axis === 'x')!
  expect(x).toMatchObject({ kind: 'face', targetId: 'a', at: 4, movingSide: 'min', targetSide: 'max' })
  expect(r.hits.find(h => h.axis === 'y')).toMatchObject({ kind: 'face', targetId: 'a', at: 0 })
  expect(r.hits).toHaveLength(3)
})

test('with no face close, a centre lined up with another board centre snaps (midpoint)', () => {
  const a = board({ id: 'a', width: 4, length: 10 })
  const b = board({ id: 'b', width: 2, length: 10, position: { x: 30, y: 0, z: 0 } })
  // a centre x = 2; b centre = x + 1. Faces of b are ~1 inch from the faces of a, so only centres are close.
  const r = snapPosition(project([a, b]), 'b', { x: 1.1, y: 40, z: 40 }, opts)
  expect(r.hits.find(h => h.axis === 'x')).toMatchObject({ kind: 'center', targetId: 'a', at: 2 })
  expect(r.position.x).toBe(1)
  expect(r.snaps[0]).toBe('center')
})

test('a face snap wins over a centre snap on the same axis', () => {
  const a = board({ id: 'a', width: 4, length: 10 })
  const b = board({ id: 'b', width: 4, length: 10, position: { x: 30, y: 0, z: 0 } })
  const r = snapPosition(project([a, b]), 'b', { x: 4.1, y: 40, z: 40 }, opts)
  expect(r.snaps[0]).toBe('face')
})

test('snapping can be switched off for a moment', () => {
  const a = board({ id: 'a', width: 4, length: 10 })
  const b = board({ id: 'b', width: 4, length: 10, position: { x: 30, y: 0, z: 0 } })
  const r = snapPosition(project([a, b]), 'b', { x: 4.1, y: 0.013, z: 0 }, { ...opts, enabled: false })
  expect(r.position).toEqual({ x: 4.1, y: 0.013, z: 0 })
  expect(r.snaps).toEqual([])
  expect(r.hits).toEqual([])
})
