import { cutList } from '../../src/model/cutlist'
import { addBoard, addJoint } from '../../src/model/ops'
import { addSketch, deleteSketch, outlinePolygons, shapeBoard, SHAPED_NOTE, unshapeBoard, updateSketch } from '../../src/model/shaped'
import type { Project } from '../../src/model/types'
import { validate } from '../../src/model/validate'
import { emptyProject } from '../../src/model/woods'
import { polygonArea, outlineFromSketch } from '../../src/sketch/geometry'
import { extrudeOutline, upFacingArea } from '../../src/ui/three/shapeGeometry'
import { apron } from './fixtures'

const WOOD = '1x6'

function shaped(): { p: Project; id: string } {
  const p = addSketch(emptyProject('T'), apron())
  const r = shapeBoard(p, null, 'k1', WOOD)
  if ('error' in r) throw new Error(r.error)
  return { p: r.project, id: r.id }
}

test('an arched apron cut from a 1x6 lists as 3/4 × 4 × 30 with the Shaped note', () => {
  const { p, id } = shaped()
  const b = p.boards.find(x => x.id === id)!
  expect(b).toMatchObject({ name: 'Apron', thickness: 0.75, width: 4, length: 30 })
  const rows = cutList(p).rows
  expect(rows).toHaveLength(1)
  expect(rows[0]).toMatchObject({ thickness: 0.75, width: 4, length: 30 })
  expect(rows[0].notes).toContain(SHAPED_NOTE)
})

test('the outline on the board has the drawing\'s area; the 3D part\'s top face matches it', () => {
  const { p, id } = shaped()
  const poly = outlinePolygons(p, p.boards.find(x => x.id === id)!)!
  const r = outlineFromSketch(apron())
  if ('error' in r) throw new Error(r.error)
  const want = polygonArea(r.outer)
  expect(Math.abs(polygonArea(poly.outer) - want) / want).toBeLessThan(0.01)
  for (const q of poly.outer) {
    expect(q.x).toBeGreaterThanOrEqual(-1e-9); expect(q.x).toBeLessThanOrEqual(4 + 1e-9)
    expect(q.y).toBeGreaterThanOrEqual(-1e-9); expect(q.y).toBeLessThanOrEqual(30 + 1e-9)
  }
  const top = upFacingArea(extrudeOutline(poly, 0.75))
  expect(Math.abs(top - want) / want).toBeLessThan(0.01)
})

test('a shaped board with a dado keeps both notes', () => {
  let { p, id } = shaped()
  const leg = addBoard(p, { woodId: WOOD, name: 'Shelf', width: 3, length: 10, position: { x: 0.5, y: 10.75, z: 0.75 }, rotation: { x: 90, y: 0, z: 0 } })
  p = leg.project
  const j = addJoint(p, 'dado', id, leg.id)
  if ('error' in j) throw new Error(j.error)
  const row = cutList(j.project).rows.find(r => r.part === 'Apron')!
  expect(row.notes).toContain(SHAPED_NOTE)
  expect(row.notes.some(n => /dado/.test(n))).toBe(true)
})

test('editing the drawing reshapes the part', () => {
  const { p, id } = shaped()
  const sk = apron()
  sk.points = sk.points.map(q => (q.id === 'p3' || q.id === 'p4' ? { ...q, x: 32 } : q.id === 'c' ? { ...q, x: 16 } : q))
  const next = updateSketch(p, sk)
  expect(next.boards.find(x => x.id === id)).toMatchObject({ width: 4, length: 32 })
})

test('a joint where the arch is cut away warns that the shape doesn\'t reach', () => {
  let { p, id } = shaped()
  // A block lying on the apron's face, right in the middle of the bottom edge — where the arch has been cut out.
  const block = addBoard(p, { woodId: WOOD, name: 'Leg', width: 1.5, length: 2, position: { x: 2.5, y: 14, z: 0.75 } })
  p = block.project
  const j = addJoint(p, 'butt', id, block.id)
  if ('error' in j) throw new Error(j.error)
  expect(validate(j.project).map(w => w.message)).toContain("The shape of Apron doesn't reach where it joins Leg")
  // Along the straight top edge there is wood, so no warning.
  const s2 = shaped()
  const ok = addBoard(s2.p, { woodId: WOOD, name: 'Leg', width: 1.5, length: 2, position: { x: 0, y: 14, z: 0.75 } })
  const j2 = addJoint(ok.project, 'butt', s2.id, ok.id)
  if ('error' in j2) throw new Error(j2.error)
  expect(validate(j2.project).some(w => /doesn't reach/.test(w.message))).toBe(false)
})

test('unshaping, or deleting the drawing, makes it a rectangle again', () => {
  const { p, id } = shaped()
  expect(unshapeBoard(p, id).boards[0].outline).toBeUndefined()
  const d = deleteSketch(p, 'k1')
  expect(d.sketches).toEqual([])
  expect(d.boards[0].outline).toBeUndefined()
  expect(d.boards[0]).toMatchObject({ width: 4, length: 30 })
})

test('an open drawing can\'t become a part', () => {
  const sk = apron()
  sk.entities = sk.entities.filter(e => e.id !== 'e2')
  const r = shapeBoard(addSketch(emptyProject('T'), sk), null, 'k1', WOOD)
  expect('error' in r && r.error).toMatch(/gap/)
})
