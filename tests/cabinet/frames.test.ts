import { worldBox } from '../../src/model/geometry'
import { cutList } from '../../src/model/cutlist'
import { validate } from '../../src/model/validate'
import { emptyProject } from '../../src/model/woods'
import { addBoard } from '../../src/model/ops'
import { ORIENT, makeBoard } from '../../src/templates/place'
import { addFaceFrame, frameOpenings, FRAME_DEFAULTS } from '../../src/cabinet/faceFrame'
import { addShelfPins, pinHoles, PIN_DEFAULTS, MM32 } from '../../src/cabinet/shelfPins'
import { addDoors, DOOR_DEFAULTS } from '../../src/cabinet/doors'
import { addDrawer, DRAWER_DEFAULTS } from '../../src/cabinet/drawers'
import { clashText, clearance, movedBoard, opened } from '../../src/cabinet/motion'
import { hardwareList, pruneHardware } from '../../src/cabinet/hardware'
import { deleteBoards } from '../../src/model/ops'
import type { Project } from '../../src/model/types'

const ok = <T,>(r: T | { error: string }): T => { if (r && typeof r === 'object' && 'error' in r) throw new Error((r as { error: string }).error); return r as T }

test('a face frame with a mid stile and a mid rail: four equal openings, pocket screws', () => {
  const f = { ...FRAME_DEFAULTS, midStiles: 1, midRails: 1 }
  const ops = frameOpenings({ x: 0, y: 0, z: 0, width: 33, height: 30 }, f, 0.75)
  expect(ops.map(o => [o.x, o.z, o.width, o.height])).toEqual([[1.5, 1.5, 14.25, 12.75], [17.25, 1.5, 14.25, 12.75], [1.5, 15.75, 14.25, 12.75], [17.25, 15.75, 14.25, 12.75]])
  const p = ok(addFaceFrame(emptyProject('T'), { x: 0, y: 0, z: 0, width: 33, height: 30 }, f)).project
  expect(cutList(p).rows.map(r => [r.qty, r.part, r.width, r.length])).toEqual(expect.arrayContaining([[2, 'Stile', 1.5, 30], [1, 'Mid stile', 1.5, 27], [2, 'Mid rail', 1.5, 14.25]]))
  expect(validate(p)).toEqual([])
  expect(hardwareList(p).rows.find(r => r.itemId === 'pocket-114')!.qty).toBe(20)
})

test('shelf pins: two rows 1-1/2" in, every 32 mm from 6" up to 6" from the top, stopped 3/8" deep', () => {
  let p = emptyProject('T')
  const side = makeBoard('Side', p.woods.find(w => w.id === 'ply-3-4')!, 11.25, 30, ORIENT.uprightY, { x: 0, y: 0, z: 0 })
  p = { ...p, boards: [side] }
  const holes = ok(pinHoles(side, { ...PIN_DEFAULTS, face: 'top' }))
  const rows = Math.floor((30 - 12) / MM32) + 1
  expect(holes).toHaveLength(rows * 2)
  expect(new Set(holes.map(h => h.u))).toEqual(new Set([1.5, 9.75]))
  expect(holes.every(h => h.depth === 0.375 && h.face === 'top')).toBe(true)
  p = ok(addShelfPins(p, side.id, { ...PIN_DEFAULTS, face: 'top', shelves: 2 }))
  expect(hardwareList(p).rows).toEqual([expect.objectContaining({ name: 'Shelf pins 5 mm', qty: 8 })])
  // Laying it out again replaces the old layout.
  p = ok(addShelfPins(p, side.id, { ...PIN_DEFAULTS, face: 'top', shelves: 3 }))
  expect(p.boards[0].holes).toHaveLength(rows * 2)
  expect(hardwareList(p).rows[0].qty).toBe(12)
  expect(cutList(p).rows[0].notes.join("|")).toBe(`${rows * 2} × 5 mm holes, 3/8" deep (shelf pins)`)
})

test('a door swings about its hinge line and a drawer slides out', () => {
  const p = ok(addDoors(emptyProject('T'), { x: 0, y: 0, z: 0, width: 15, height: 30 }, { ...DOOR_DEFAULTS, style: 'slab', panelWood: 'ply-3-4' })).project
  const g = p.groups![0]
  const door = movedBoard(p.boards[0], g.motion!, 1)
  const b = worldBox(door)
  // Hinged on the left at its front corner (x −1/2, y −3/4): opened 95°, it stands out in front, at the hinge.
  expect(b.min.y).toBeLessThan(-15)
  expect(b.max.x).toBeLessThan(0.5)
  const d = ok(addDrawer(emptyProject('T'), { x: 0, y: 0, z: 0, width: 16, height: 6, depth: 22 }, DRAWER_DEFAULTS)).project
  const out = opened(d, 0.5)
  expect(worldBox(out.boards[0]).min.y).toBeCloseTo(worldBox(d.boards[0]).min.y - 10)
})

test('clearance: a door that hits a drawer face is found; a well-spaced cabinet passes', () => {
  // A door hinged on the right, and a drawer unit standing out in front of the cabinet, right where the door swings.
  let p = ok(addDoors(emptyProject('T'), { x: 0, y: 0, z: 0, width: 15, height: 30 }, { ...DOOR_DEFAULTS, style: 'slab', panelWood: 'ply-3-4', hinge: 'right' })).project
  p = ok(addDrawer(p, { x: 16.5, y: -12, z: 10, width: 10, height: 6, depth: 22 }, DRAWER_DEFAULTS)).project
  const hits = clearance(p)
  expect(hits.length).toBeGreaterThan(0)
  expect(clashText(p, hits[0])).toMatch(/^Door 1 hits Drawer 1 at \d+% open$/)
  // Spaced well apart: nothing.
  let q = ok(addDoors(emptyProject('T'), { x: 0, y: 0, z: 0, width: 15, height: 30 }, { ...DOOR_DEFAULTS, style: 'slab', panelWood: 'ply-3-4' })).project
  q = ok(addDrawer(q, { x: 40, y: 0, z: 0, width: 16, height: 6, depth: 22 }, DRAWER_DEFAULTS)).project
  expect(clearance(q)).toEqual([])
})

test('deleting a door takes its hardware with it', () => {
  const p = ok(addDoors(emptyProject('T'), { x: 0, y: 0, z: 0, width: 15, height: 30 }, DOOR_DEFAULTS)).project
  expect(p.hardware!.length).toBeGreaterThan(0)
  const gone = pruneHardware(deleteBoards(p, p.boards.map(b => b.id)) as Project)
  expect(gone.hardware).toBeUndefined()
  void addBoard
})

test('the opening between two cabinet sides, and inside a frame', async () => {
  const { openingFrom } = await import('../../src/cabinet/build')
  const { applyTemplate } = await import('../../src/templates')
  const shelf = applyTemplate(emptyProject('T'), 'bookshelf', { shelves: 0, back: false })
  const sides = shelf.boards.filter(b => b.name === 'Side').map(b => b.id)
  const o = ok(openingFrom(shelf, sides))
  expect([o.x, o.width, o.y, o.depth]).toEqual([0.71875, 30 - 2 * 0.71875, 0, 10])
  const f = ok(addFaceFrame(emptyProject('T'), { x: 0, y: 0, z: 0, width: 20, height: 30 }, FRAME_DEFAULTS)).project
  const inner = ok(openingFrom(f, f.boards.map(b => b.id)))
  expect([inner.x, inner.z, inner.width, inner.height]).toEqual([1.5, 1.5, 17, 27])
  expect(openingFrom(f, [f.boards[0].id])).toEqual({ error: 'Select the two sides (or the four parts) around the opening' })
})

test('copying a door copies its hardware and moves its hinge line with it', async () => {
  const { copyGroup } = await import('../../src/assemblies/ops')
  const p = ok(addDoors(emptyProject('T'), { x: 0, y: 0, z: 0, width: 15, height: 30 }, { ...DOOR_DEFAULTS, style: 'slab', panelWood: 'ply-3-4' })).project
  const c = ok(copyGroup(p, p.groups![0].id, false))
  const copy = c.project.groups!.find(g => g.id === c.id)!
  expect(hardwareList(c.project).rows.find(r => r.itemId === 'hinge-full')!.qty).toBe(4)
  const shift = worldBox(c.project.boards[1]).min.x - worldBox(c.project.boards[0]).min.x
  expect(copy.motion!.kind === 'swing' && copy.motion!.origin.x).toBe(-0.5 + shift)
})
