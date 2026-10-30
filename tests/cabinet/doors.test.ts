import { worldBox } from '../../src/model/geometry'
import { cutList } from '../../src/model/cutlist'
import { validate } from '../../src/model/validate'
import { emptyProject } from '../../src/model/woods'
import { addDoors, DOOR_DEFAULTS, hingeCount, hingeHeights } from '../../src/cabinet/doors'
import { hardwareList } from '../../src/cabinet/hardware'
import { interferences } from '../../src/checks/solids'
import type { Project } from '../../src/model/types'

const opening = { x: 0, y: 0, z: 0, width: 15, height: 30 }
function door(opts = {}) {
  const r = addDoors(emptyProject('T'), opening, { ...DOOR_DEFAULTS, ...opts })
  if ('error' in r) throw new Error(r.error)
  return r
}
const rows = (p: Project) => cutList(p).rows.map(r => [r.qty, r.part, r.width, r.length])

test('a Shaker door, full overlay, on a 15 × 30 opening: 16 × 31 with a grooved frame and a flat panel', () => {
  const { project: p, groupIds } = door()
  expect(p.groups!.map(g => g.name)).toEqual(['Door 1'])
  expect(rows(p)).toEqual(expect.arrayContaining([
    // The two stiles differ: one takes the hinges, the other the knob.
    [1, 'Stile', 2.25, 31],
    [2, 'Rail', 2.25, 12.25],
    [1, 'Panel', 12.125, 27.125]
  ]))
  // The whole door: 16 × 31, standing 3/4" in front of the opening.
  const boxes = p.boards.map(worldBox)
  expect(Math.min(...boxes.map(b => b.min.x))).toBe(-0.5)
  expect(Math.max(...boxes.map(b => b.max.x))).toBe(15.5)
  expect(Math.min(...boxes.map(b => b.min.z))).toBe(-0.5)
  expect(Math.max(...boxes.map(b => b.max.z))).toBe(30.5)
  expect(Math.max(...boxes.map(b => b.max.y))).toBe(0)
  // Joints are all good and nothing runs into anything.
  expect(validate(p)).toEqual([])
  expect(interferences(p)).toEqual([])
  expect(groupIds).toHaveLength(1)
  // Two hinges, 4" from each end, cups 7/8" in from the hinge edge.
  const stile = p.boards.find(b => b.holes.some(h => h.diameter === 1.375))!
  expect(stile.holes.filter(h => h.diameter === 1.375).map(h => h.u)).toEqual([0.875, 0.875])
  expect(stile.holes.filter(h => h.diameter === 1.375).map(h => h.v).sort((a, b) => a - b)).toEqual([4, 27])
  const hw = hardwareList(p).rows.map(r => [r.name, r.qty])
  expect(hw).toEqual(expect.arrayContaining([['Concealed hinge, full overlay (35 mm)', 2], ['Knob 1-1/4"', 1], ['Wood screws #6 × 5/8"', 8]]))
})

test('hinge counts by height', () => {
  expect([30, 40, 41, 60, 61].map(hingeCount)).toEqual([2, 2, 3, 3, 4])
  expect(hingeHeights(48)).toEqual([4, 24, 44])
})

test('half overlay, inset and pairs', () => {
  const half = door({ style: 'slab', mounting: 'half', panelWood: 'ply-3-4' }).project
  expect(rows(half)).toEqual([[1, 'Door', 15.5, 30.5]])
  const inset = door({ style: 'slab', mounting: 'inset', panelWood: 'ply-3-4' }).project
  expect(rows(inset)).toEqual([[1, 'Door', 14.875, 29.875]])
  expect(worldBox(inset.boards[0]).min.y).toBe(0)
  const pair = door({ style: 'slab', mounting: 'full', pair: true, panelWood: 'ply-3-4' })
  expect(pair.groupIds).toHaveLength(2)
  expect(rows(pair.project)).toEqual([[1, 'Door', 7.9375, 31], [1, 'Door', 7.9375, 31]])
  // The pair hinge on the outsides and open away from each other.
  expect(pair.project.groups!.map(g => g.motion && g.motion.kind === 'swing' ? g.motion.dir : 0)).toEqual([-1, 1])
})

test('raised-panel and glass doors are sound; glass is listed by size', () => {
  // (On a 14" opening, so the panel fits a 12"-wide hardwood board.)
  const r = addDoors(emptyProject('T'), { ...opening, width: 14 }, { ...DOOR_DEFAULTS, style: 'raised', panelWood: 'hw-4-4' })
  if ('error' in r) throw new Error(r.error)
  const raised = r.project
  expect(validate(raised)).toEqual([])
  expect(interferences(raised)).toEqual([])
  const glass = door({ style: 'glass' }).project
  expect(validate(glass)).toEqual([])
  expect(interferences(glass)).toEqual([])
  expect(rows(glass)).toEqual(expect.arrayContaining([[2, 'Rail', 2.25, 11.5]]))
  const g = hardwareList(glass).rows.find(r => r.itemId === 'glass-18')!
  expect(g.note).toBe('12.125 × 27.125')
})

test('openings too small for the frame are refused', () => {
  expect(addDoors(emptyProject('T'), { ...opening, width: 5 }, DOOR_DEFAULTS)).toEqual({ error: 'The opening is too small for those stiles and rails' })
})
