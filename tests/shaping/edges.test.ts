import { cutList } from '../../src/model/cutlist'
import { cutGeometry, pointRemovedBy } from '../../src/model/joints'
import { addBoard } from '../../src/model/ops'
import type { Project } from '../../src/model/types'
import { emptyProject } from '../../src/model/woods'
import { addEdgeProfile, edgeNotes, MSG_TURNED_EDGE, profileSection, removeEdgeProfile } from '../../src/shaping/edges'
import { turnBoard } from '../../src/shaping/turning'
import { polygonArea } from '../../src/sketch/geometry'

const top = (): { p: Project; id: string } => {
  const r = addBoard(emptyProject('T'), { woodId: '1x12', name: 'Top', width: 11.25, length: 30 })
  return { p: r.project, id: r.id }
}
const ok = (r: Project | { error: string }): Project => { if ('error' in r) throw new Error(r.error); return r }
const ALL = ['left', 'right', 'start', 'end'] as const

test.each([
  ['roundover', (s: number) => s * s - (Math.PI * s * s) / 4],
  ['chamfer', (s: number) => (s * s) / 2],
  ['cove', (s: number) => (Math.PI * s * s) / 4],
  ['ogee', (s: number) => (s * s) / 2]
] as const)('a %s takes away the right amount of wood', (kind, area) => {
  const a = polygonArea(profileSection(kind, 0.5))
  expect(Math.abs(a - area(0.5)) / area(0.5)).toBeLessThan(0.01)
})

test('size limits: deeper than the board, or top and bottom together through it', () => {
  const { p, id } = top()
  expect(addEdgeProfile(p, id, { profile: 'roundover', size: 0.875, face: 'top', sides: ['left'] })).toEqual({ error: 'A 7/8" roundover is too big for this board' })
  const half = ok(addEdgeProfile(p, id, { profile: 'roundover', size: 0.5, face: 'top', sides: ['left'] }))
  expect(addEdgeProfile(half, id, { profile: 'roundover', size: 0.375, face: 'bottom', sides: ['left'] })).toEqual({ error: 'A 3/8" roundover is too big for this board' })
  expect('error' in addEdgeProfile(half, id, { profile: 'roundover', size: 0.375, face: 'bottom', sides: ['right'] })).toBe(false)
})

test('cut list notes', () => {
  const { p, id } = top()
  const q = ok(addEdgeProfile(ok(addEdgeProfile(p, id, { profile: 'roundover', size: 0.25, face: 'top', sides: [...ALL] })), id, { profile: 'chamfer', size: 0.25, face: 'bottom', sides: ['right', 'left'] }))
  expect(edgeNotes(q.boards[0])).toEqual(['1/4" roundover — top edges (all 4)', '1/4" chamfer — bottom: left, right'])
  expect(cutList(q).rows[0].notes).toContain('1/4" roundover — top edges (all 4)')
  expect(removeEdgeProfile(q, id, q.boards[0].edges![0].id).boards[0].edges).toHaveLength(1)
})

test('two parts the same except their edges are listed separately; the same profile added to each groups', () => {
  let { p, id } = top()
  const b2 = addBoard(p, { woodId: '1x12', name: 'Top', width: 11.25, length: 30, position: { x: 20, y: 0, z: 0 } })
  p = b2.project
  expect(cutList(p).rows).toHaveLength(1)
  p = ok(addEdgeProfile(p, id, { profile: 'roundover', size: 0.25, face: 'top', sides: [...ALL] }))
  expect(cutList(p).rows).toHaveLength(2)
  p = ok(addEdgeProfile(p, b2.id, { profile: 'roundover', size: 0.25, face: 'top', sides: [...ALL] }))
  expect(cutList(p).rows).toHaveLength(1)
})

test('a turned leg can only be profiled at its ends', () => {
  const r = addBoard(emptyProject('T'), { woodId: '2x2', name: 'Leg', width: 1.5, length: 29 })
  const t = turnBoard(r.project, r.id, { style: 'taper' })
  if ('error' in t) throw new Error(t.error)
  expect(addEdgeProfile(t.project, r.id, { profile: 'chamfer', size: 0.125, face: 'top', sides: ['left'] })).toEqual({ error: MSG_TURNED_EDGE })
  expect('error' in addEdgeProfile(t.project, r.id, { profile: 'chamfer', size: 0.125, face: 'top', sides: ['end'] })).toBe(false)
})

test('the cuts remove the corner along each chosen edge', () => {
  const { p, id } = top()
  const q = ok(addEdgeProfile(p, id, { profile: 'roundover', size: 0.25, face: 'top', sides: ['left'] }))
  const b = q.boards[0]
  const cuts = cutGeometry(q).filter(c => c.kind === 'profile')
  expect(cuts).toHaveLength(1)
  expect(pointRemovedBy(cuts[0], { x: 0.01, y: 10, z: 0.74 }, b)).toBe(true)
  expect(pointRemovedBy(cuts[0], { x: 0.2, y: 10, z: 0.6 }, b)).toBe(false)
  expect(pointRemovedBy(cuts[0], { x: 0.01, y: 10, z: 0.1 }, b)).toBe(false)
})
