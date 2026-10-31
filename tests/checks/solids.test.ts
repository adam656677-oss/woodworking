import { addBoard, addJoint } from '../../src/model/ops'
import type { Project } from '../../src/model/types'
import { emptyProject } from '../../src/model/woods'
import { applyTemplate } from '../../src/templates'
import { interferences, localSolids, volumeAndCentroid, weigh } from '../../src/checks/solids'
import { densityOf } from '../../src/checks/density'
import { explodeOffsets } from '../../src/checks/explode'
import { groupBoards } from '../../src/assemblies/ops'

const two = (bx: number, init: object = {}) => {
  let p = emptyProject('T')
  const a = addBoard(p, { woodId: '1x6', name: 'A', width: 5.5, length: 12, position: { x: 0, y: 0, z: 0 } }); p = a.project
  const b = addBoard(p, { woodId: '1x6', name: 'B', width: 5.5, length: 12, position: { x: bx, y: 0, z: 0 }, ...init }); p = b.project
  return { p, a: a.id, b: b.id }
}

test('densities: known species, plywood, and an estimate for unknown ones', () => {
  expect(densityOf('Pine')).toEqual({ lbPerCuFt: 28, estimated: false })
  expect(densityOf('White Oak').lbPerCuFt).toBe(47)
  expect(densityOf('Red oak').lbPerCuFt).toBe(44)
  expect(densityOf('Plywood').lbPerCuFt).toBe(34)
  expect(densityOf('Purpleheart')).toEqual({ lbPerCuFt: 56, estimated: false })
  expect(densityOf('Mystery wood')).toEqual({ lbPerCuFt: 35, estimated: true })
})

test('a plain board weighs its volume × density; the centre of mass is its middle', () => {
  const { p } = two(20)
  const r = weigh(p)
  // 3/4 × 5-1/2 × 12 = 49.5 cu in of pine at 28 lb/ft³.
  expect(r.parts[0].volume).toBeCloseTo(49.5, 6)
  expect(r.parts[0].pounds).toBeCloseTo((49.5 / 1728) * 28, 6)
  expect(r.pounds).toBeCloseTo(2 * (49.5 / 1728) * 28, 6)
  expect(r.centre!.x).toBeCloseTo((2.75 + 22.75) / 2, 6)
  expect(r.centre!.y).toBeCloseTo(6, 6)
  expect(r.centre!.z).toBeCloseTo(0.375, 6)
  expect(r.estimated).toBe(false)
})

test('a hole and a rotated board are weighed from their real shapes', () => {
  const { p, a } = two(20, { rotation: { x: 0, y: 0, z: 90 } })
  const holed: Project = { ...p, boards: p.boards.map(b => (b.id === a ? { ...b, holes: [{ diameter: 2, u: 2.75, v: 6 }] } : b)) }
  const r = weigh(holed)
  expect(r.parts[0].volume).toBeCloseTo(49.5 - Math.PI * 0.75, 1)
  expect(r.parts[1].volume).toBeCloseTo(49.5, 6)
})

test('interference: overlapping boards are found with their shared volume; touching boards are not', () => {
  expect(interferences(two(5.5).p)).toEqual([])
  const { p, a, b } = two(5)
  const hits = interferences(p)
  expect(hits).toHaveLength(1)
  expect(hits[0]).toMatchObject({ a, b })
  // 1/2 × 12 × 3/4 = 4.5 cu in shared.
  expect(hits[0].volume).toBeCloseTo(4.5, 4)
})

test('a shelf seated in its dado is not an interference; a live bookshelf is clean', () => {
  const p = applyTemplate(emptyProject('T'), 'bookshelf', {})
  expect(interferences(p)).toEqual([])
  const r = weigh(p)
  expect(r.pounds).toBeGreaterThan(20)
  expect(r.pounds).toBeLessThan(80)
})

test('a tall narrow piece with a high centre of mass gets the tipping hint', () => {
  let p = emptyProject('T')
  p = addBoard(p, { woodId: '1x6', name: 'Post', width: 5.5, length: 60, position: { x: 0, y: 0, z: 0 }, rotation: { x: 90, y: 0, z: 0 } }).project
  p = addBoard(p, { woodId: 'hw-8-4', name: 'Top', width: 5.5, length: 12, position: { x: 0, y: -12, z: 60 } }).project
  expect(weigh(p).tipping).toMatch(/^Centre of mass is high — \d+% of the height; anchor tall pieces to the wall$/)
  expect(weigh(two(20).p).tipping).toBeNull()
})

test('volumeAndCentroid of a unit cube', async () => {
  const THREE = await import('three')
  const g = new THREE.BoxGeometry(1, 1, 1)
  const r = volumeAndCentroid(g)
  expect(r.volume).toBeCloseTo(1)
  expect(r.centroid.x).toBeCloseTo(0)
  expect(localSolids(two(20).p).size).toBe(2)
})

test('explode: nothing at 0%; groups move out as units, parts from their group centre', () => {
  const { p, a, b } = two(20)
  expect(explodeOffsets(p, 0).size).toBe(0)
  const off = explodeOffsets(p, 1)
  // Design centre x = 12.75; A's centre 2.75 → -10.
  expect(off.get(a)!.x).toBeCloseTo(-10)
  expect(off.get(b)!.x).toBeCloseTo(10)
  const g = groupBoards(p, [a, b], 'Pair')
  if ('error' in g) throw new Error(g.error)
  // The pair is the whole design, so the group stays put and its parts open up 40% as far: -10 × 0.5 × 0.4.
  const og = explodeOffsets(g.project, 0.5)
  expect(og.get(a)!.x).toBeCloseTo(-2)
  void addJoint
})
