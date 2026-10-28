import { validate } from '../../src/model/validate'
import type { Joint } from '../../src/model/types'
import { board, project } from './helpers'

test('un-joined intersecting boards → overlap naming both', () => {
  const a = board({ id: 'a', name: 'A', width: 4, length: 10 })
  const b = board({ id: 'b', name: 'B', width: 4, length: 10, position: { x: 2, y: 0, z: 0.25 } })
  const w = validate(project([a, b]))
  expect(w).toEqual([{ kind: 'overlap', boardIds: ['a', 'b'], message: 'A and B overlap' }])
})

test('touching boards and joined boards are not overlaps', () => {
  const a = board({ id: 'a', width: 4, length: 10 })
  const touching = board({ id: 'b', width: 4, length: 10, position: { x: 4, y: 0, z: 0 } })
  expect(validate(project([a, touching]))).toEqual([])
  const inside = board({ id: 'c', width: 4, length: 10, position: { x: 3.9, y: 0, z: 0 } })
  const j: Joint = { id: 'j', type: 'butt', hostBoardId: 'a', partnerBoardId: 'c', params: { fastener: 'glue', count: 0 } }
  expect(validate(project([a, inside], [j])).filter(x => x.kind === 'overlap')).toEqual([])
})

test('too long or too wide for the stock', () => {
  const long = board({ id: 'l', name: 'Rail', woodId: '1x6', thickness: 0.75, width: 5.5, length: 150 })
  const wide = board({ id: 'r', name: 'Roof', woodId: '1x6', thickness: 0.75, width: 8.5, length: 8.5, position: { x: 20, y: 0, z: 0 } })
  const w = validate(project([long, wide]))
  expect(w).toContainEqual({ kind: 'exceedsStock', boardIds: ['l'], message: 'Rail is longer than 1x6 (144")' })
  expect(w).toContainEqual({ kind: 'exceedsStock', boardIds: ['r'], message: 'Roof is wider than 1x6 (5-1/2")' })
})

test('width and length are not swapped to make a part fit', () => {
  const b = board({ id: 'x', name: 'X', woodId: '1x6', thickness: 0.75, width: 8, length: 5 })
  expect(validate(project([b])).map(w => w.kind)).toEqual(['exceedsStock'])
})

test('thickness must match the wood', () => {
  const b = board({ id: 't', name: 'T', woodId: '1x6', thickness: 1, width: 5.5, length: 10 })
  expect(validate(project([b]))).toEqual([{ kind: 'exceedsStock', boardIds: ['t'], message: "T: Thickness doesn't match 1x6" }])
})

test('bad joints and impossible angles', () => {
  const side = board({ id: 's', name: 'Side', length: 36 })
  const shelf = board({ id: 'h', name: 'Shelf', width: 9, length: 28, position: { x: 30, y: 0, z: 0 } })
  const j: Joint = { id: 'j', type: 'dado', hostBoardId: 's', partnerBoardId: 'h', params: { width: 0.75, depth: 0.5, offset: 6, face: 'top' } }
  const w = validate(project([side, shelf], [j]))
  expect(w).toEqual([{ kind: 'badJoint', boardIds: ['s', 'h'], message: expect.stringMatching(/half/) }])
  const steep = board({ id: 'a', name: 'Steep', endCuts: { start: { miter: 70, bevel: 0 }, end: { miter: 0, bevel: 0 } } })
  expect(validate(project([steep]))[0]).toMatchObject({ kind: 'badJoint', boardIds: ['a'] })
})
