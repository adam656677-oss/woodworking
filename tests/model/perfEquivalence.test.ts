// The faster versions of hot functions must answer exactly as the plain versions did. Each test here keeps the plain
// version beside the fast one and compares them on the kitchen fixture and on awkward random cases.
import { groupBoardIds, groupsWithParts, ancestry } from '../../src/assemblies/ops'
import { grooveBetween, grooveIndex } from '../../src/model/contact'
import { type Box, rotateVec, toWorld, worldBox } from '../../src/model/geometry'
import { deserialize } from '../../src/model/fileFormat'
import { jointsTouching } from '../../src/model/joints'
import { isAxisAligned } from '../../src/model/geometry'
import { overlappingPairs } from '../../src/model/validate'
import type { Board, Project, Vec3 } from '../../src/model/types'
import { buildBoardGeometry, clearShapeCache } from '../../src/ui/three/BoardMesh'
import { fixtureText } from '../perf/harness'
import { board } from './helpers'

/** A seeded random stream, so a failure can be repeated. */
function rng(seed: number) {
  let s = seed
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296 }
}

// ---- geometry: the original arithmetic, kept as the reference ----
const clean = (n: number) => Math.round(n * 1e9) / 1e9 + 0
function refRotateVec(v: Vec3, rotDeg: Vec3): Vec3 {
  const [ax, ay, az] = [rotDeg.x, rotDeg.y, rotDeg.z].map(d => (d * Math.PI) / 180)
  let { x, y, z } = v
  ;[x, y] = [x * Math.cos(az) - y * Math.sin(az), x * Math.sin(az) + y * Math.cos(az)]
  ;[x, z] = [x * Math.cos(ay) + z * Math.sin(ay), -x * Math.sin(ay) + z * Math.cos(ay)]
  ;[y, z] = [y * Math.cos(ax) - z * Math.sin(ax), y * Math.sin(ax) + z * Math.cos(ax)]
  return { x: clean(x), y: clean(y), z: clean(z) }
}
function refToWorld(b: Board, p: Vec3): Vec3 {
  const r = refRotateVec(p, b.rotation)
  return { x: clean(r.x + b.position.x), y: clean(r.y + b.position.y), z: clean(r.z + b.position.z) }
}
function refWorldBox(b: Board): Box {
  const pts: Vec3[] = []
  for (const x of [0, b.width]) for (const y of [0, b.length]) for (const z of [0, b.thickness]) pts.push(refToWorld(b, { x, y, z }))
  return {
    min: { x: Math.min(...pts.map(p => p.x)), y: Math.min(...pts.map(p => p.y)), z: Math.min(...pts.map(p => p.z)) },
    max: { x: Math.max(...pts.map(p => p.x)), y: Math.max(...pts.map(p => p.y)), z: Math.max(...pts.map(p => p.z)) }
  }
}

test('rotateVec, toWorld and worldBox give the same numbers as before, bit for bit', () => {
  const r = rng(7)
  const angle = () => [0, 90, -90, 180, 270, 45, -30, 17.5, 60][Math.floor(r() * 9)]
  for (let i = 0; i < 400; i++) {
    const b = board({
      id: `b${i}`, width: Math.round(r() * 960) / 64 + 1 / 64, length: Math.round(r() * 3000) / 64 + 1 / 64, thickness: Math.round(r() * 96) / 64 + 1 / 64,
      position: { x: Math.round(r() * 4000) / 64 - 20, y: Math.round(r() * 4000) / 64 - 20, z: Math.round(r() * 4000) / 64 }, rotation: { x: angle(), y: angle(), z: angle() }
    })
    const v = { x: r() * 50 - 10, y: r() * 50 - 10, z: r() * 50 - 10 }
    expect(rotateVec(v, b.rotation)).toEqual(refRotateVec(v, b.rotation))
    expect(toWorld(b, v)).toEqual(refToWorld(b, v))
    expect(worldBox(b)).toEqual(refWorldBox(b))
  }
})

// ---- overlap sweep ----
function naivePairs(boards: Board[]): [number, number][] {
  const TOUCH = 1 / 64
  const out: [number, number][] = []
  for (let i = 0; i < boards.length; i++) for (let k = i + 1; k < boards.length; k++) {
    const A = refWorldBox(boards[i]), B = refWorldBox(boards[k])
    if ((['x', 'y', 'z'] as const).every(ax => Math.min(A.max[ax], B.max[ax]) - Math.max(A.min[ax], B.min[ax]) > TOUCH)) out.push([i, k])
  }
  return out
}

test('the overlap sweep finds the same pairs, in the same order, as testing every pair', () => {
  const r = rng(99)
  for (let round = 0; round < 12; round++) {
    // Boards on a coarse grid so many just touch, overlap by exactly 1/64", or by a lot.
    const boards: Board[] = []
    for (let i = 0; i < 120; i++) {
      boards.push(board({
        id: `o${round}_${i}`, width: 1 + Math.floor(r() * 6) * 0.5, length: 2 + Math.floor(r() * 8), thickness: 0.75,
        position: { x: Math.floor(r() * 10) * 0.5 + (r() < 0.2 ? 1 / 64 : 0), y: Math.floor(r() * 10) * 0.5, z: Math.floor(r() * 6) * 0.75 },
        rotation: { x: [0, 90][Math.floor(r() * 2)], y: [0, 90][Math.floor(r() * 2)], z: [0, 90][Math.floor(r() * 2)] }
      }))
    }
    expect(overlappingPairs(boards)).toEqual(naivePairs(boards))
  }
  const kitchen = deserialize(fixtureText()).boards.filter(isAxisAligned)
  expect(overlappingPairs(kitchen)).toEqual(naivePairs(kitchen))
})

// ---- lookups ----
test('grooveIndex finds the first dado or rabbet between two parts, either way round, like scanning the joints', () => {
  const p = deserialize(fixtureText())
  const find = grooveIndex(p.joints)
  const ids = p.boards.map(b => b.id)
  const r = rng(5)
  for (const j of p.joints) {
    expect(find(j.hostBoardId, j.partnerBoardId)).toBe(grooveBetween(p.joints, j.hostBoardId, j.partnerBoardId))
    expect(find(j.partnerBoardId, j.hostBoardId)).toBe(grooveBetween(p.joints, j.partnerBoardId, j.hostBoardId))
  }
  for (let i = 0; i < 300; i++) {
    const a = ids[Math.floor(r() * ids.length)], b = ids[Math.floor(r() * ids.length)]
    expect(find(a, b)).toBe(grooveBetween(p.joints, a, b))
  }
})

test('jointsTouching lists exactly the joints that name the part, in joint order', () => {
  const p = deserialize(fixtureText())
  for (const b of p.boards) {
    expect(jointsTouching(p, b.id)).toEqual(p.joints.filter(j => j.hostBoardId === b.id || j.partnerBoardId === b.id))
  }
  expect(jointsTouching(p, 'nobody')).toEqual([])
})

const naiveMembers = (p: Project, gid: string) => p.boards.filter(b => ancestry(p, b.groupId).some(g => g.id === gid)).map(b => b.id)

test('group membership by walking up from each part matches asking every part for its whole ancestry', () => {
  const p = deserialize(fixtureText())
  for (const g of p.groups ?? []) expect(groupBoardIds(p, g.id)).toEqual(naiveMembers(p, g.id))
  const withParts = groupsWithParts(p)
  for (const g of p.groups ?? []) expect(withParts.has(g.id)).toBe(naiveMembers(p, g.id).length > 0)
  // A loop of parents and a missing parent must not hang or change the answer.
  const looped: Project = {
    ...p,
    groups: [...(p.groups ?? []), { id: 'loopA', name: 'A', parentId: 'loopB' }, { id: 'loopB', name: 'B', parentId: 'loopA' }, { id: 'orphan', name: 'O', parentId: 'gone' }],
    boards: p.boards.map((b, i) => (i < 3 ? { ...b, groupId: ['loopA', 'loopB', 'orphan'][i] } : b))
  }
  for (const g of looped.groups!) expect(groupBoardIds(looped, g.id)).toEqual(naiveMembers(looped, g.id))
  expect(groupBoardIds(looped, 'nothing')).toEqual([])
})

// ---- part shapes ----
test('a part shape asked for twice is the same object, and a recomputed one is the same shape', () => {
  const b = board({ id: 'x', width: 6, length: 20, thickness: 0.75 })
  const cuts = [{ boardId: 'x', kind: 'dado' as const, min: { x: 0, y: 5, z: 0.25 }, max: { x: 6, y: 5.75, z: 0.75 } }]
  clearShapeCache()
  const first = buildBoardGeometry(b, cuts)
  expect(buildBoardGeometry(b, cuts)).toBe(first)
  // A different cut (or size) is a different shape.
  const deeper = buildBoardGeometry(b, [{ ...cuts[0], min: { ...cuts[0].min, z: 0.125 } }])
  expect(deeper).not.toBe(first)
  expect(buildBoardGeometry({ ...b, length: 21 }, cuts)).not.toBe(first)
  // Forgetting everything and building again gives the same triangles.
  const before = Array.from(first.getAttribute('position').array)
  clearShapeCache()
  const again = buildBoardGeometry(b, cuts)
  expect(again).not.toBe(first)
  expect(Array.from(again.getAttribute('position').array)).toEqual(before)
})
