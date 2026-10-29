import { worldBox } from '../../src/model/geometry'
import { cutGeometry, pointRemovedBy } from '../../src/model/joints'
import { addBoard, rotateBoard, setEndCut } from '../../src/model/ops'
import { cutList } from '../../src/model/cutlist'
import type { Board, Project } from '../../src/model/types'
import { emptyProject } from '../../src/model/woods'
import {
  cuttingOrder, defaultStart, faceNormalWorld, insideFaces, jigAt12, MSG_FOOT_BIG, MSG_START, MSG_TURNED, removedPerFace,
  TAPER_NOTE, taperAngle, taperBoard, taperCuts, taperLength
} from '../../src/shaping/taper'
import { turnBoard } from '../../src/shaping/turning'

/** A 1-1/2" × 29-1/2" leg standing upright with its foot on the floor at (x, y). */
function legAt(p: Project, x: number, y: number, name = 'Leg'): { p: Project; id: string } {
  const r = addBoard(p, { woodId: '2x2', name, width: 1.5, length: 29.5 })
  let q = rotateBoard(r.project, r.id, 'x', 90)
  const b = worldBox(q.boards.find(b => b.id === r.id)!)
  q = { ...q, boards: q.boards.map(o => (o.id === r.id ? { ...o, position: { x: o.position.x - b.min.x + x, y: o.position.y - b.min.y + y, z: o.position.z - b.min.z } } : o)) }
  return { p: q, id: r.id }
}
const T2 = { faces: ['left', 'top'] as ('left' | 'top')[], start: 6, foot: 0.875 }
const legBoard = (): Board => legAt(emptyProject('T'), 0, 0).p.boards[0]

test('hand-worked: 1-1/2 → 7/8 over 23-1/2 on two adjacent faces', () => {
  const b = legBoard()
  expect(taperLength(b, T2)).toBe(23.5)
  expect(removedPerFace(b, T2)).toEqual({ left: 0.625, right: 0, top: 0.625, bottom: 0 })
  expect(taperAngle(b, T2)).toBeCloseTo(1.52, 2)
  expect(jigAt12(b, T2)).toBeCloseTo(0.319, 3)
})

test('opposite faces and all four faces share the reduction; one face takes it all', () => {
  const b = legBoard()
  expect(removedPerFace(b, { ...T2, faces: ['left', 'right', 'top', 'bottom'] })).toEqual({ left: 0.3125, right: 0.3125, top: 0.3125, bottom: 0.3125 })
  expect(removedPerFace(b, { ...T2, faces: ['left', 'right'] })).toMatchObject({ left: 0.3125, right: 0.3125 })
  expect(removedPerFace(b, { ...T2, faces: ['left'] }).left).toBe(0.625)
})

test('the cut list note', () => {
  const { p, id } = legAt(emptyProject('T'), 0, 0)
  const q = taperBoard(p, id, T2) as Project
  expect(cutList(q).rows[0].notes).toContain('Taper 2 faces: 1-1/2" → 7/8" over 23-1/2", starting 6" from the top')
  expect(TAPER_NOTE(q.boards[0], { ...T2, faces: ['left'] })).toMatch(/^Taper 1 face:/)
})

test('impossible tapers are refused', () => {
  const { p, id } = legAt(emptyProject('T'), 0, 0)
  expect(taperBoard(p, id, { ...T2, foot: 2 })).toEqual({ error: MSG_FOOT_BIG })
  expect(taperBoard(p, id, { ...T2, start: 29.5 })).toEqual({ error: MSG_START })
  const flat = addBoard(emptyProject('T'), { woodId: '2x2', name: 'Leg', width: 1.5, length: 29.5 })
  const turned = turnBoard(flat.project, flat.id, { style: 'taper' })
  if ('error' in turned) throw new Error(turned.error)
  expect(taperBoard(turned.project, flat.id, T2)).toEqual({ error: MSG_TURNED })
})

test('the taper planes take exactly the right amount off at the foot, nothing above the start', () => {
  const { p, id } = legAt(emptyProject('T'), 0, 0)
  const b = (taperBoard(p, id, T2) as Project).boards[0]
  const cuts = taperCuts(b)
  expect(cuts).toHaveLength(2)
  // Upright with its end up: the top is y = 29.5, the foot y = 0.
  const left = cuts.find(c => c.plane.normal.x === -1)!
  expect(pointRemovedBy(left, { x: 0.62, y: 0.001, z: 0.7 })).toBe(true)
  expect(pointRemovedBy(left, { x: 0.63, y: 0.001, z: 0.7 })).toBe(false)
  // 1" below the start, 1/38" (0.0266") is gone; above the start nothing is.
  expect(pointRemovedBy(left, { x: 0.02, y: 29.5 - 7, z: 0.7 })).toBe(true)
  expect(pointRemovedBy(left, { x: 0.03, y: 29.5 - 7, z: 0.7 })).toBe(false)
  expect(pointRemovedBy(left, { x: 0.001, y: 29.5 - 5, z: 0.7 })).toBe(false)
  const top = cuts.find(c => c.plane.normal.z === 1)!
  expect(pointRemovedBy(top, { x: 0.7, y: 0.001, z: 1.5 - 0.62 })).toBe(true)
  expect(pointRemovedBy(top, { x: 0.7, y: 0.001, z: 1.5 - 0.63 })).toBe(false)
})

test('a taper and an end miter both cut', () => {
  const { p, id } = legAt(emptyProject('T'), 0, 0)
  const q = setEndCut(taperBoard(p, id, T2) as Project, id, 'start', { miter: 15 }) as Project
  const kinds = cutGeometry(q).filter(c => c.boardId === id).map(c => c.kind)
  expect(kinds).toContain('miter')
  expect(kinds.filter(k => k === 'taper')).toHaveLength(2)
})

test('inside faces of a table\'s legs look toward the middle of the table', () => {
  let p = emptyProject('T')
  const ids: string[] = []
  for (const [x, y] of [[0, 0], [28.5, 0], [0, 18.5], [28.5, 18.5]]) { const r = legAt(p, x, y); p = r.p; ids.push(r.id) }
  for (const id of ids) {
    const b = p.boards.find(o => o.id === id)!
    const me = worldBox(b)
    const to = { x: 15 - (me.min.x + me.max.x) / 2, y: 10 - (me.min.y + me.max.y) / 2 }
    for (const f of insideFaces(p, b)) {
      const n = faceNormalWorld(b, f)
      expect(n.x * to.x + n.y * to.y).toBeGreaterThan(0)
    }
  }
})

test('a taper starts 1/2" below the apron it meets', () => {
  let { p, id } = legAt(emptyProject('T'), 0, 0)
  const apron = addBoard(p, { woodId: '1x6', name: 'Apron', thickness: 5.5, width: 0.75, length: 20, position: { x: 1.5, y: 0, z: 24 } })
  p = apron.project
  expect(defaultStart(p, p.boards.find(b => b.id === id)!)).toBe(6)
  expect(defaultStart(emptyProject('T'), addBoard(emptyProject('T'), { woodId: '2x2', width: 1.5, length: 30 }).project.boards[0])).toBe(5)
})

test('the cutting order', () => {
  expect(cuttingOrder(T2)).toHaveLength(2)
  expect(cuttingOrder({ ...T2, faces: ['left', 'right', 'top', 'bottom'] })[1]).toMatch(/Tape the offcuts back on/)
})
