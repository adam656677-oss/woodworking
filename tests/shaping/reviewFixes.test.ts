import { cutList } from '../../src/model/cutlist'
import { worldBox } from '../../src/model/geometry'
import { addBoard, changeWood, duplicateBoards, mirrorBoards, rotateBoard } from '../../src/model/ops'
import type { Project } from '../../src/model/types'
import { validate } from '../../src/model/validate'
import { emptyProject } from '../../src/model/woods'
import { addEdgeProfile, profileCuts } from '../../src/shaping/edges'
import { insideFaces, taperBoard } from '../../src/shaping/taper'
import { profileRadii, turnBoard } from '../../src/shaping/turning'
import { holeInset, insetPolygon } from '../../src/ui/three/shapeGeometry'
import { turnedLeg } from '../../src/ui/three/turnedGeometry'
import { polygonArea } from '../../src/sketch/geometry'

const ok = (r: Project | { error: string }): Project => { if ('error' in r) throw new Error(r.error); return r }

function legAt(p: Project, x: number, y: number): { p: Project; id: string } {
  const r = addBoard(p, { woodId: '2x2', name: 'Leg', width: 1.5, length: 29.5 })
  let q = rotateBoard(r.project, r.id, 'x', 90)
  const b = worldBox(q.boards.find(b => b.id === r.id)!)
  q = { ...q, boards: q.boards.map(o => (o.id === r.id ? { ...o, position: { x: o.position.x - b.min.x + x, y: o.position.y - b.min.y + y, z: o.position.z - b.min.z } } : o)) }
  return { p: q, id: r.id }
}
function table(): { p: Project; ids: string[] } {
  let p = emptyProject('T')
  const ids: string[] = []
  for (const [x, y] of [[0, 0], [28.5, 0], [0, 18.5], [28.5, 18.5]]) { const r = legAt(p, x, y); p = r.p; ids.push(r.id) }
  return { p, ids }
}

test('a turned leg is light enough to draw quickly', () => {
  const { p, ids } = table()
  const t = turnBoard(p, ids[0], { style: 'beadCove', shoulder: 'lambsTongue', top: 5, bottom: 1 })
  if ('error' in t) throw new Error(t.error)
  const b = t.project.boards.find(x => x.id === ids[0])!
  const start = performance.now()
  const g = turnedLeg({ blank: 1.5, length: 29.5, top: 5, bottom: 1, radii: profileRadii(t.project, b)!, fromStart: true })
  const ms = performance.now() - start
  expect(g.getAttribute('position').count / 3).toBeLessThan(20000)
  expect(ms).toBeLessThan(400)
})

test('four legs tapered on their inside faces are one cut-list row of 4', () => {
  let { p, ids } = table()
  for (const id of ids) p = ok(taperBoard(p, id, { faces: insideFaces(p, p.boards.find(b => b.id === id)!), start: 6, foot: 0.875 }))
  const rows = cutList(p).rows
  expect(rows).toHaveLength(1)
  expect(rows[0].qty).toBe(4)
})

test('four legs each turned to the same style are one cut-list row of 4', () => {
  let { p, ids } = table()
  for (const id of ids) { const r = turnBoard(p, id, { style: 'vase', top: 5 }); if ('error' in r) throw new Error(r.error); p = r.project }
  expect(cutList(p).rows.map(r => r.qty)).toEqual([4])
})

test('mirroring a leg puts its taper and edge profiles on the mirrored faces', () => {
  const { p, id } = legAt(emptyProject('T'), 0, 0)
  const q = ok(addEdgeProfile(ok(taperBoard(p, id, { faces: ['right', 'top'], start: 6, foot: 0.875 })), id, { profile: 'chamfer', size: 0.125, face: 'top', sides: ['right'] }))
  const d = duplicateBoards(q, [id])
  const m = mirrorBoards(d.project, d.ids, 'x')
  const copy = m.boards.find(b => b.id === d.ids[0])!
  expect([...copy.taper!.faces].sort()).toEqual(['left', 'top'])
  expect(copy.edges![0].sides).toEqual(['left'])
})

test('a taper or edge profile that no longer fits warns, and the cut list leaves it out', () => {
  const { p, id } = legAt(emptyProject('T'), 0, 0)
  const tapered = ok(taperBoard(p, id, { faces: ['left', 'top'], start: 6, foot: 1.25 }))
  const short = { ...tapered, boards: tapered.boards.map(b => ({ ...b, length: 5 })) }
  expect(validate(short).map(w => w.message)).toContain("Leg's taper doesn't fit any more — The taper can't start below the foot. It isn't shown until it fits.")
  expect(cutList(short).rows[0].notes.some(n => n.startsWith('Taper'))).toBe(false)

  const top = addBoard(emptyProject('T'), { woodId: '2x6', name: 'Top', width: 5.5, length: 30 })
  let q = ok(addEdgeProfile(top.project, top.id, { profile: 'roundover', size: 1, face: 'top', sides: ['left'] }))
  q = ok(addEdgeProfile(q, top.id, { profile: 'chamfer', size: 0.25, face: 'top', sides: ['right'] }))
  q = changeWood(q, top.id, '1x6')
  expect(validate(q).some(w => /1" roundover doesn't fit any more/.test(w.message))).toBe(true)
  expect(cutList(q).rows[0].notes).toContain('1/4" chamfer — top: right')
  expect(cutList(q).rows[0].notes.some(n => /roundover/.test(n))).toBe(false)
  // The one that fits is still cut; a new one can still be added.
  expect(profileCuts(q.boards[0])).toHaveLength(1)
  expect('error' in addEdgeProfile(q, top.id, { profile: 'chamfer', size: 0.125, face: 'bottom', sides: ['start'] })).toBe(false)
})

test('a router bit round a cutout makes the hole bigger at the top, not smaller', () => {
  const hole = [{ x: 0, y: 0 }, { x: 0, y: 2 }, { x: 2, y: 2 }, { x: 2, y: 0 }]
  // As extrudeOutline uses it for holes.
  expect(polygonArea(holeInset(hole, 0.25))).toBeCloseTo(6.25, 6)
  expect(polygonArea(holeInset([...hole].reverse(), 0.25))).toBeCloseTo(6.25, 6)
  expect(polygonArea(insetPolygon(hole, 0.25))).toBeCloseTo(2.25, 6)
})

test('changing a turning setting keeps the diameters that were set', () => {
  const r0 = addBoard(emptyProject('T'), { woodId: '2x2', name: 'Leg', width: 1.5, length: 29 })
  let r = turnBoard(r0.project, r0.id, { style: 'vase', maxD: 1.375, minD: 0.625 })
  for (const top of [4, 4.5, 5, 5.5, 6]) {
    if ('error' in r) throw new Error(r.error)
    r = turnBoard(r.project, r0.id, { style: 'vase', top })
  }
  if ('error' in r) throw new Error(r.error)
  expect(r.project.boards[0].turning).toMatchObject({ top: 6, maxD: 1.375, minD: 0.625 })
})
