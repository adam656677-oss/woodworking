import { boardForBox, cutThrough, facePlane, faceFromNormal, FLOOR, FRONT, isBlock, profileProblem, pullProfile, pushPullFace, SIDE, worldToPlane, planeToWorld } from '../../src/modeling/core'
import { localAxes, worldBox } from '../../src/model/geometry'
import { cutList } from '../../src/model/cutlist'
import { outlinePolygons } from '../../src/model/shaped'
import type { Project } from '../../src/model/types'
import { emptyProject } from '../../src/model/woods'

const P = () => emptyProject('m')
const ok = <T,>(r: T | { error: string }): T => { if (r && typeof r === 'object' && 'error' in r) throw new Error((r as { error: string }).error); return r as T }
const box = (p: Project, id: string) => worldBox(p.boards.find(b => b.id === id)!)
const part = (p: Project, id: string) => p.boards.find(b => b.id === id)!

test('planes: sketch coordinates map to the floor, front wall and side wall, and back again', () => {
  expect(planeToWorld(FLOOR, { x: 3, y: 4 }, 2)).toEqual({ x: 3, y: 4, z: 2 })
  // Front wall: sketch x runs right, y runs up; pulling out of it comes toward you (−y).
  expect(planeToWorld(FRONT, { x: 3, y: 4 }, 2)).toEqual({ x: 3, y: -2, z: 4 })
  expect(planeToWorld(SIDE, { x: 3, y: 4 }, 2)).toEqual({ x: 2, y: 3, z: 4 })
  expect(worldToPlane(FRONT, { x: 3, y: -2, z: 4 })).toEqual({ q: { x: 3, y: 4 }, h: 2 })
})

test('a rectangle pulled off the floor is a board; its thinnest side becomes the thickness', () => {
  // A 3 × 3 square pulled up 29": a leg (3 thick, 3 wide, 29 long, standing up).
  let p = P()
  const leg = ok(pullProfile(p, FLOOR, { kind: 'rect', a: { x: 0, y: 0 }, b: { x: 3, y: 3 } }, 29, 'hw-8-4', 'Leg'))
  p = leg.project
  expect([part(p, leg.id).thickness, part(p, leg.id).width, part(p, leg.id).length]).toEqual([3, 3, 29])
  expect(box(p, leg.id)).toEqual({ min: { x: 0, y: 0, z: 0 }, max: { x: 3, y: 3, z: 29 } })
  // A 30 × 18 rectangle pulled up 3/4: a flat top lying on the floor, 30 long.
  const top = ok(pullProfile(p, FLOOR, { kind: 'rect', a: { x: 10, y: 0 }, b: { x: 40, y: 18 } }, 0.75, 'ply-3-4', 'Top'))
  expect(box(top.project, top.id)).toEqual({ min: { x: 10, y: 0, z: 0 }, max: { x: 40, y: 18, z: 0.75 } })
  expect(localAxes(part(top.project, top.id)).length.axis).toBe('x')
})

test('every way a block can sit maps onto exactly its box', () => {
  const sizes = [[1, 2, 3], [1, 3, 2], [2, 1, 3], [2, 3, 1], [3, 1, 2], [3, 2, 1]]
  for (const [x, y, z] of sizes) {
    const b = { min: { x: 5, y: -2, z: 1 }, max: { x: 5 + x, y: -2 + y, z: 1 + z } }
    const f = boardForBox(b)
    expect([f.thickness, f.width, f.length]).toEqual([1, 2, 3])
    const r = ok(pullProfile(P(), FLOOR, { kind: 'rect', a: { x: 0, y: 0 }, b: { x: 1, y: 1 } }, 1, 'ply-3-4', 'x'))
    expect(worldBox({ ...part(r.project, r.id), ...f })).toEqual(b)
  }
})

test('pulling the other way (negative) goes below the plane; pulling off the front wall comes toward you', () => {
  const down = ok(pullProfile(P(), FLOOR, { kind: 'rect', a: { x: 0, y: 0 }, b: { x: 10, y: 4 } }, -0.75, 'ply-3-4', 'Shelf'))
  expect(box(down.project, down.id)).toEqual({ min: { x: 0, y: 0, z: -0.75 }, max: { x: 10, y: 4, z: 0 } })
  const front = ok(pullProfile(P(), FRONT, { kind: 'rect', a: { x: 0, y: 0 }, b: { x: 24, y: 30 } }, 0.75, 'ply-3-4', 'Door'))
  expect(box(front.project, front.id)).toEqual({ min: { x: 0, y: -0.75, z: 0 }, max: { x: 24, y: 0, z: 30 } })
})

test('a circle pulled 3/4 is a round shaped part lying where it was drawn', () => {
  for (const pl of [FLOOR, FRONT, SIDE]) {
    const r = ok(pullProfile(P(), pl, { kind: 'circle', c: { x: 10, y: 6 }, r: 5 }, 0.75, 'ply-3-4', 'Round top'))
    const b = part(r.project, r.id)
    expect([b.thickness, b.width, b.length]).toEqual([0.75, 10, 10])
    expect(b.outline).toBeTruthy()
    const lo = planeToWorld(pl, { x: 5, y: 1 }, 0), hi = planeToWorld(pl, { x: 15, y: 11 }, 0.75)
    const want = { min: { x: Math.min(lo.x, hi.x), y: Math.min(lo.y, hi.y), z: Math.min(lo.z, hi.z) }, max: { x: Math.max(lo.x, hi.x), y: Math.max(lo.y, hi.y), z: Math.max(lo.z, hi.z) } }
    expect([pl.label, box(r.project, r.id)]).toEqual([pl.label, want])
  }
})

test('an L-shaped outline becomes a shaped part with that outline (long side with the grain)', () => {
  const L = [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 4 }, { x: 4, y: 4 }, { x: 4, y: 12 }, { x: 0, y: 12 }]
  const r = ok(pullProfile(P(), FLOOR, { kind: 'poly', pts: L }, 0.75, 'ply-3-4', 'Bracket'))
  const b = part(r.project, r.id)
  expect([b.width, b.length]).toEqual([12, 20])
  expect(box(r.project, r.id)).toEqual({ min: { x: 0, y: 0, z: 0 }, max: { x: 20, y: 12, z: 0.75 } })
  expect(outlinePolygons(r.project, b)!.outer).toHaveLength(6)
  expect(cutList(r.project).rows[0]).toMatchObject({ part: 'Bracket', width: 12, length: 20 })
})

test('bad profiles are explained', () => {
  expect(profileProblem({ kind: 'poly', pts: [{ x: 0, y: 0 }, { x: 4, y: 4 }, { x: 4, y: 0 }, { x: 0, y: 4 }] })).toMatch(/crosses itself/)
  expect(profileProblem({ kind: 'rect', a: { x: 1, y: 1 }, b: { x: 1, y: 5 } })).toMatch(/width and height/)
  expect('error' in pullProfile(P(), FLOOR, { kind: 'rect', a: { x: 0, y: 0 }, b: { x: 4, y: 4 } }, 0, 'ply-3-4', 'x')).toBe(true)
})

test('face planes sit on the face, facing out', () => {
  const r = ok(pullProfile(P(), FLOOR, { kind: 'rect', a: { x: 0, y: 0 }, b: { x: 30, y: 12 } }, 0.75, 'ply-3-4', 'Shelf'))
  const b = part(r.project, r.id)
  const top = facePlane(b, 'z', 'max')
  expect(top.origin.z).toBe(0.75)
  expect(top.n).toEqual({ x: 0, y: 0, z: 1 })
  expect(faceFromNormal({ x: 0, y: -0.99, z: 0.1 })).toEqual({ axis: 'y', side: 'min' })
  const front = facePlane(b, 'y', 'min')
  expect(front.n).toEqual({ x: 0, y: -1, z: 0 })
})

test('cut through: a rectangle becomes a hole, a corner rectangle a notch, a small circle a drilled hole', () => {
  let p = ok(pullProfile(P(), FLOOR, { kind: 'rect', a: { x: 0, y: 0 }, b: { x: 30, y: 12 } }, 0.75, 'ply-3-4', 'Panel')).project
  const id = p.boards[0].id
  const top = facePlane(part(p, id), 'z', 'max')
  // A 4 × 2 slot in the middle.
  p = ok(cutThrough(p, id, top, { kind: 'rect', a: { x: 13, y: 5 }, b: { x: 17, y: 7 } }, -0.75))
  expect(outlinePolygons(p, part(p, id))!.holes).toHaveLength(1)
  expect(box(p, id)).toEqual({ min: { x: 0, y: 0, z: 0 }, max: { x: 30, y: 12, z: 0.75 } })
  // A 2 × 2 notch out of the front-left corner keeps the part where it is.
  p = ok(cutThrough(p, id, top, { kind: 'rect', a: { x: -1, y: -1 }, b: { x: 2, y: 2 } }, -1))
  expect(outlinePolygons(p, part(p, id))!.outer).toHaveLength(6)
  expect(box(p, id)).toEqual({ min: { x: 0, y: 0, z: 0 }, max: { x: 30, y: 12, z: 0.75 } })
  // A 1/2" circle on a plain part is a drilled hole.
  let q = ok(pullProfile(P(), FLOOR, { kind: 'rect', a: { x: 0, y: 0 }, b: { x: 30, y: 12 } }, 0.75, 'ply-3-4', 'Panel')).project
  const qid = q.boards[0].id
  q = ok(cutThrough(q, qid, facePlane(part(q, qid), 'z', 'max'), { kind: 'circle', c: { x: 5, y: 6 }, r: 0.25 }, -0.75))
  expect(part(q, qid).holes).toHaveLength(1)
  expect(part(q, qid).outline).toBeUndefined()
})

test('a cut that stops short, misses, or splits the part is refused with a reason', () => {
  const p = ok(pullProfile(P(), FLOOR, { kind: 'rect', a: { x: 0, y: 0 }, b: { x: 30, y: 12 } }, 0.75, 'ply-3-4', 'Panel')).project
  const id = p.boards[0].id
  const top = facePlane(part(p, id), 'z', 'max')
  expect(ok({ e: (cutThrough(p, id, top, { kind: 'rect', a: { x: 1, y: 1 }, b: { x: 3, y: 3 } }, -0.25) as { error: string }).error }).e).toMatch(/all the way through/)
  expect((cutThrough(p, id, top, { kind: 'rect', a: { x: 40, y: 1 }, b: { x: 43, y: 3 } }, -1) as { error: string }).error).toMatch(/doesn't touch/)
  expect((cutThrough(p, id, top, { kind: 'rect', a: { x: 14, y: -1 }, b: { x: 16, y: 13 } }, -1) as { error: string }).error).toMatch(/split/)
  expect((cutThrough(p, id, facePlane(part(p, id), 'y', 'min'), { kind: 'rect', a: { x: 1, y: 0 }, b: { x: 3, y: 0.5 } }, -1) as { error: string }).error).toMatch(/Joint designer/)
})

test('push/pull a face: the part grows or shrinks from that face only', () => {
  let p = ok(pullProfile(P(), FLOOR, { kind: 'rect', a: { x: 0, y: 0 }, b: { x: 30, y: 12 } }, 0.75, 'ply-3-4', 'Shelf')).project
  const id = p.boards[0].id
  p = ok(pushPullFace(p, id, 'x', 'max', 6))
  expect(box(p, id)).toEqual({ min: { x: 0, y: 0, z: 0 }, max: { x: 36, y: 12, z: 0.75 } })
  p = ok(pushPullFace(p, id, 'x', 'min', 2))
  expect(box(p, id)).toEqual({ min: { x: -2, y: 0, z: 0 }, max: { x: 36, y: 12, z: 0.75 } })
  p = ok(pushPullFace(p, id, 'y', 'min', -4))
  expect(box(p, id)).toEqual({ min: { x: -2, y: 4, z: 0 }, max: { x: 36, y: 12, z: 0.75 } })
  p = ok(pushPullFace(p, id, 'z', 'max', 0.75))
  expect(part(p, id).thickness).toBe(1.5)
  expect((pushPullFace(p, id, 'y', 'max', -9) as { error: string }).error).toMatch(/too thin/)
})

test('a block (every side 4" or more) is offered for splitting into panels; a board is not', () => {
  const blk = ok(pullProfile(P(), FLOOR, { kind: 'rect', a: { x: 0, y: 0 }, b: { x: 30, y: 12 } }, 36, 'ply-3-4', 'Bookcase'))
  expect(isBlock(part(blk.project, blk.id))).toBe(true)
  const brd = ok(pullProfile(P(), FLOOR, { kind: 'rect', a: { x: 0, y: 0 }, b: { x: 30, y: 12 } }, 0.75, 'ply-3-4', 'Shelf'))
  expect(isBlock(part(brd.project, brd.id))).toBe(false)
})
