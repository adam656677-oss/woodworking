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
