import { worldBox } from '../../src/model/geometry'
import { emptyProject } from '../../src/model/woods'
import { makeBoard, ORIENT } from '../../src/templates/place'
import { removeJoint, updateJoint } from '../../src/model/ops'
import { addDoors, DOOR_DEFAULTS } from '../../src/cabinet/doors'
import { addDrawer, DRAWER_DEFAULTS } from '../../src/cabinet/drawers'
import { clearance, followMotion, opened } from '../../src/cabinet/motion'
import { hardwareList, pruneHardware } from '../../src/cabinet/hardware'
import { addShelfPins, PIN_DEFAULTS } from '../../src/cabinet/shelfPins'
import { moveGroup, rotateGroup, ungroup } from '../../src/assemblies/ops'
import { localSolids, volumeAndCentroid } from '../../src/checks/solids'
import { recalc } from '../../src/formulas/recalc'
import { setSize } from '../../src/formulas/ops'
import type { GrooveParams, Project } from '../../src/model/types'

const ok = <T,>(r: T | { error: string }): T => { if (r && typeof r === 'object' && 'error' in r) throw new Error((r as { error: string }).error); return r as T }
const ply = emptyProject('T').woods.find(w => w.id === 'ply-3-4')!

/** Two 3/4" ply sides 23" deep, 30" tall, 18" outside: a frameless carcass. */
function carcass(p: Project, x0: number): Project {
  const l = makeBoard('Side', ply, 23, 30, ORIENT.uprightY, { x: x0, y: 0, z: 0 })
  const r = makeBoard('Side', ply, 23, 30, ORIENT.uprightY, { x: x0 + 18 - ply.thickness, y: 0, z: 0 })
  return { ...p, boards: [...p.boards, l, r] }
}
const opening = (x0: number) => ({ x: x0 + ply.thickness, y: 0, z: 0, width: 18 - 2 * ply.thickness, height: 30 })

test('an overlay door opens clear of its own carcass, and doors on neighbouring cabinets hinged toward each other clear', () => {
  for (const style of ['slab', 'shaker'] as const) for (const hinge of ['left', 'right'] as const) {
    const p = ok(addDoors(carcass(emptyProject('T'), 0), opening(0), { ...DOOR_DEFAULTS, style, hinge, panelWood: style === 'slab' ? 'ply-3-4' : 'ply-1-4' })).project
    expect([style, hinge, clearance(p)]).toEqual([style, hinge, []])
  }
  let p = carcass(carcass(emptyProject('T'), 0), 18)
  p = ok(addDoors(p, opening(0), { ...DOOR_DEFAULTS, style: 'slab', panelWood: 'ply-3-4', hinge: 'right' })).project
  p = ok(addDoors(p, opening(18), { ...DOOR_DEFAULTS, style: 'slab', panelWood: 'ply-3-4', hinge: 'left' })).project
  expect(clearance(p)).toEqual([])
})

test('a door moved or turned as a group still swings about its own hinge', () => {
  const p0 = ok(addDoors(emptyProject('T'), { x: 0, y: 0, z: 0, width: 15, height: 30 }, { ...DOOR_DEFAULTS, style: 'slab', panelWood: 'ply-3-4' })).project
  const gid = p0.groups![0].id
  const shiftOpen = (p: Project) => { const a = worldBox(p.boards[0]), b = worldBox(opened(p, 1).boards[0]); return [b.min.x - a.min.x, b.min.y - a.min.y] }
  const moved = followMotion(p0, moveGroup(p0, gid, 'x', 100))
  expect(shiftOpen(moved).map(v => Math.round(v * 1000))).toEqual(shiftOpen(p0).map(v => Math.round(v * 1000)))
  const turned = followMotion(p0, rotateGroup(p0, gid, 'z', 180))
  const a = worldBox(turned.boards[0]), b = worldBox(opened(turned, 1).boards[0])
  // Turned round, the door faces back (+y) and swings out that way.
  expect(b.max.y).toBeGreaterThan(a.max.y + 10)
})

test('removing or changing a stub-tenon cheek or a glass rabbet leaves the other part alone', () => {
  const p = ok(addDoors(emptyProject('T'), { x: 0, y: 0, z: 0, width: 15, height: 30 }, DOOR_DEFAULTS)).project
  const cheek = p.joints.find(j => j.type === 'rabbet' && (j.params as GrooveParams).standalone)!
  const partner = () => p.boards.find(b => b.id === cheek.partnerBoardId)!.width
  expect(removeJoint(p, cheek.id).boards.find(b => b.id === cheek.partnerBoardId)!.width).toBe(partner())
  expect(updateJoint(p, cheek.id, { depth: 0.3125 }).boards.find(b => b.id === cheek.partnerBoardId)!.width).toBe(partner())
})

test('a stopped hole removes just its own depth', () => {
  let p = emptyProject('T')
  const b = makeBoard('Side', ply, 10, 10, ORIENT.flatY, { x: 0, y: 0, z: 0 }, { holes: [{ diameter: 1, u: 5, v: 5, depth: 0.375, face: 'top' }] })
  p = { ...p, boards: [b] }
  const v = volumeAndCentroid(localSolids(p).get(b.id)!).volume
  // (The drill is a 32-sided cylinder.)
  expect(10 * 10 * ply.thickness - v).toBeCloseTo(16 * 0.25 * Math.sin(Math.PI / 16) * 0.375, 4)
})

test('ungrouping a door keeps its hardware', () => {
  const p = ok(addDoors(emptyProject('T'), { x: 0, y: 0, z: 0, width: 15, height: 30 }, DOOR_DEFAULTS)).project
  const before = hardwareList(p).rows.map(r => [r.name, r.qty])
  expect(hardwareList(pruneHardware(ungroup(p, p.groups![0].id))).rows.map(r => [r.name, r.qty])).toEqual(before)
})

test('shelf pins on both faces of a divider; drawer bottom grooves keep their 1/4" width through a recalculation', () => {
  let p: Project = { ...emptyProject('T'), boards: [makeBoard('Divider', ply, 12, 30, ORIENT.uprightY, { x: 0, y: 0, z: 0 })] }
  const id = p.boards[0].id
  p = ok(addShelfPins(p, id, { ...PIN_DEFAULTS, face: 'top', shelves: 2 }))
  p = ok(addShelfPins(p, id, { ...PIN_DEFAULTS, face: 'bottom', shelves: 2 }))
  expect(new Set(p.boards[0].holes.map(h => h.face))).toEqual(new Set(['top', 'bottom']))
  expect(hardwareList(p).rows.reduce((n, r) => n + r.qty, 0)).toBe(16)
  const d = ok(addDrawer(emptyProject('T'), { x: 0, y: 0, z: 0, width: 16, height: 6, depth: 22 }, DRAWER_DEFAULTS)).project
  const withSize = recalc(ok(setSize(d, 'W', '1'))).project
  const bottomId = withSize.boards.find(b => b.name === 'Drawer bottom')!.id
  expect(withSize.joints.filter(j => j.partnerBoardId === bottomId).map(j => (j.params as GrooveParams).width)).toEqual([0.25, 0.25, 0.25, 0.25])
})
