import { addBoard } from '../../src/model/ops'
import { emptyProject } from '../../src/model/woods'
import { groupBoards } from '../../src/assemblies/ops'
import { explodeOffsets } from '../../src/checks/explode'
import { densityOf } from '../../src/checks/density'
import { pickOnModel } from '../../src/checks/pick'

test('grouping changes the explode: a group moves out as a unit, its parts spread less inside it', () => {
  let p = emptyProject('T')
  const ids: string[] = []
  for (const x of [0, 10, 30, 40]) { const r = addBoard(p, { woodId: '1x6', name: `B${x}`, width: 5.5, length: 20, position: { x, y: 0, z: 0 } }); p = r.project; ids.push(r.id) }
  const loose = explodeOffsets(p, 1)
  const g = groupBoards(p, [ids[0], ids[1]], 'Drawer')
  if ('error' in g) throw new Error(g.error)
  const grouped = explodeOffsets(g.project, 1)
  // The two grouped parts keep closer together than when loose.
  const gap = (m: Map<string, { x: number }>) => m.get(ids[1])!.x - m.get(ids[0])!.x
  expect(gap(grouped)).toBeLessThan(gap(loose))
  // The loose parts are unchanged.
  expect(grouped.get(ids[3])!.x).toBeCloseTo(loose.get(ids[3])!.x)
})

test('plywood and MDF weigh as sheet goods, whatever species is in the name', () => {
  for (const n of ['Birch plywood', 'Baltic birch plywood', 'Oak plywood', 'Maple ply']) expect(densityOf(n).lbPerCuFt).toBe(34)
  expect(densityOf('Oak MDF veneer').lbPerCuFt).toBe(47)
  expect(densityOf('White oak').lbPerCuFt).toBe(47)
})

test('a click in a section view lands on the cut face, not on the part cut away; exploded points come back to the model', () => {
  const box = { min: { x: -1, y: -1, z: -1 }, max: { x: 1, y: 1, z: 1 } }
  // Section keeps x < 0 (plane normal -x through 0). The ray comes from +x and first hits the hidden face at x = 1.
  const plane = { normal: { x: -1, y: 0, z: 0 }, constant: 0 }
  const ray = { origin: { x: 10, y: 0, z: 0 }, direction: { x: -1, y: 0, z: 0 } }
  expect(pickOnModel({ x: 1, y: 0, z: 0 }, ray, box, plane, undefined)).toEqual({ x: 0, y: 0, z: 0 })
  // A ray that only passes through the cut-away half: not this part.
  const miss = { origin: { x: 10, y: 0, z: 0 }, direction: { x: -1, y: 0, z: 0.5 } }
  expect(pickOnModel({ x: 0.9, y: 0, z: 0.95 }, miss, { min: { x: -1, y: -1, z: -1 }, max: { x: 1, y: 1, z: 0.96 } }, plane, undefined)).toBeNull()
  // A visible hit is kept; an exploded part's point is moved back by its offset.
  expect(pickOnModel({ x: -0.5, y: 1, z: 0 }, ray, box, plane, { x: 0, y: 5, z: 0 })).toEqual({ x: -0.5, y: -4, z: 0 })
})

test('a file with a blank note is refused; repeated annotation ids keep the first', async () => {
  const { serialize, deserialize } = await import('../../src/model/fileFormat')
  const p = { ...emptyProject('T'), annotations: [{ id: 'n1', kind: 'note' as const, at: { x: 0, y: 0, z: 0 }, text: 'a' }, { id: 'n1', kind: 'note' as const, at: { x: 1, y: 0, z: 0 }, text: 'b' }] }
  expect(deserialize(serialize(p)).annotations).toEqual([p.annotations[0]])
  const blank = { ...p, annotations: [{ ...p.annotations[0], text: '  ' }] }
  expect(() => deserialize(serialize(blank))).toThrow(/dimension or note is damaged/)
})
