import { worldBox } from '../../src/model/geometry'
import { addBoard, addJoint, deleteBoards, removeJoint, updateBoard, updateJoint, moveBoard } from '../../src/model/ops'
import type { Project } from '../../src/model/types'
import { emptyProject } from '../../src/model/woods'
import {
  copyGroup, groupBoardIds, groupBoards, groupBox, moveGroup, pruneGroups, rotateGroup, syncLinks, ungroup, unlinkGroup, wholeGroup
} from '../../src/assemblies/ops'

const ok = <T,>(r: T | { error: string }): T => { if (r && typeof r === 'object' && 'error' in r) throw new Error((r as { error: string }).error); return r as T }

/** A little drawer: bottom flat, two sides standing on it. */
function drawer() {
  let p = emptyProject('T')
  const add = (name: string, init: object) => { const r = addBoard(p, { woodId: '1x6', name, ...init }); p = r.project; return r.id }
  const bottom = add('Bottom', { width: 5.5, length: 12, position: { x: 0, y: 0, z: 0 } })
  const left = add('Side', { width: 4, length: 12, position: { x: 0.75, y: 0, z: 0.75 }, rotation: { x: 0, y: -90, z: 0 } })
  const right = add('Side', { width: 4, length: 12, position: { x: 5.5, y: 0, z: 0.75 }, rotation: { x: 0, y: -90, z: 0 } })
  const loose = add('Loose', { width: 3, length: 3, position: { x: 40, y: 0, z: 0 } })
  return { p, bottom, left, right, loose }
}
const board = (p: Project, id: string) => p.boards.find(b => b.id === id)!

test('grouping, nesting and ungrouping', () => {
  const d = drawer()
  const r = ok(groupBoards(d.p, [d.left, d.right], 'Sides'))
  let p = r.project
  expect(board(p, d.left).groupId).toBe(r.id)
  // Selecting the whole Sides group and the bottom nests Sides inside the new group.
  const outer = ok(groupBoards(p, [d.left, d.right, d.bottom], 'Drawer'))
  p = outer.project
  expect(p.groups!.find(g => g.id === r.id)!.parentId).toBe(outer.id)
  expect(board(p, d.bottom).groupId).toBe(outer.id)
  expect(groupBoardIds(p, outer.id).sort()).toEqual([d.bottom, d.left, d.right].sort())
  expect(wholeGroup(p, [d.left, d.right, d.bottom])!.id).toBe(outer.id)
  expect(wholeGroup(p, [d.left, d.right])!.id).toBe(r.id)
  expect(wholeGroup(p, [d.left])).toBeNull()
  // Ungrouping the outer group lifts Sides and the bottom back to the top level.
  p = ungroup(p, outer.id)
  expect(p.groups!.map(g => g.name)).toEqual(['Sides'])
  expect(p.groups![0].parentId).toBeUndefined()
  expect(board(p, d.bottom).groupId).toBeUndefined()
})

test('a new group made inside a group stays inside it; errors are plain', () => {
  const d = drawer()
  let p = ok(groupBoards(d.p, [d.left, d.right, d.bottom], 'Drawer')).project
  const inner = ok(groupBoards(p, [d.left, d.right], 'Sides'))
  p = inner.project
  expect(p.groups!.find(g => g.id === inner.id)!.parentId).toBe(p.groups!.find(g => g.name === 'Drawer')!.id)
  expect(groupBoards(p, [d.left], 'X')).toEqual({ error: 'Select two or more parts to group' })
  expect(groupBoards(p, [d.left, d.right], 'X')).toEqual({ error: 'These parts are already the group Sides' })
})

test('deleting parts prunes empty groups; damaged references are cleaned', () => {
  const d = drawer()
  const r = ok(groupBoards(d.p, [d.left, d.right], 'Sides'))
  const p = pruneGroups(deleteBoards(r.project, [d.left, d.right]))
  expect(p.groups).toBeUndefined()
  const damaged: Project = { ...d.p, groups: [{ id: 'g1', name: 'A', parentId: 'g2' }, { id: 'g2', name: 'B', parentId: 'g1' }, { id: 'g3', name: 'C', parentId: 'nope' }], boards: d.p.boards.map((b, i) => ({ ...b, groupId: ['g1', 'g3', 'missing', undefined][i] })) }
  const clean = pruneGroups(damaged)
  expect(clean.boards.map(b => b.groupId)).toEqual(['g1', 'g3', undefined, undefined])
  expect(clean.groups!.find(g => g.id === 'g3')!.parentId).toBeUndefined()
  // The loop is broken somewhere: no group is its own ancestor.
  const g1 = clean.groups!.find(g => g.id === 'g1')!, g2 = clean.groups!.find(g => g.id === 'g2')
  expect(!(g1.parentId === 'g2' && g2?.parentId === 'g1')).toBe(true)
})

test('moving and turning a group keeps its parts where they are relative to each other', () => {
  const d = drawer()
  const r = ok(groupBoards(d.p, [d.left, d.right, d.bottom], 'Drawer'))
  let p = moveGroup(r.project, r.id, 'x', 10)
  expect(groupBox(p, r.id)!.min.x).toBe(10)
  expect(worldBox(board(p, d.right)).min.x - worldBox(board(p, d.left)).min.x).toBe(4.75)
  const box0 = groupBox(p, r.id)!
  p = rotateGroup(p, r.id, 'z', 90)
  const box1 = groupBox(p, r.id)!
  const c = (b: typeof box0) => ({ x: (b.min.x + b.max.x) / 2, y: (b.min.y + b.max.y) / 2 })
  expect(c(box1).x).toBeCloseTo(c(box0).x)
  expect(c(box1).y).toBeCloseTo(c(box0).y)
  expect(box1.max.x - box1.min.x).toBeCloseTo(box0.max.y - box0.min.y)
  // The sides are now 4-3/4" apart along Y instead of X.
  expect(Math.abs(worldBox(board(p, d.right)).min.y - worldBox(board(p, d.left)).min.y)).toBeCloseTo(4.75)
  expect(worldBox(board(p, d.loose)).min.x).toBe(40)
})

test('a plain copy is independent; a linked copy shares link keys', () => {
  const d = drawer()
  let p = ok(addJoint(ok(groupBoards(d.p, [d.left, d.right, d.bottom], 'Drawer')).project, 'butt', d.left, d.bottom) as unknown as { project: Project } | { error: string }).project
  const gid = p.groups![0].id
  const plain = ok(copyGroup(p, gid, false))
  expect(plain.project.groups!.find(g => g.id === plain.id)!.name).toBe('Drawer (copy)')
  expect(plain.project.boards.some(b => b.link)).toBe(false)
  const linked = ok(copyGroup(p, gid, true))
  p = linked.project
  expect(groupBoardIds(p, linked.id)).toHaveLength(3)
  expect(p.joints).toHaveLength(2)
  const orig = p.groups!.find(g => g.id === gid)!
  expect(orig.link).toBeTruthy()
  expect(p.groups!.find(g => g.id === linked.id)!.link).toBe(orig.link)
  const keys = (gid2: string) => groupBoardIds(p, gid2).map(id => board(p, id).link).sort()
  expect(keys(gid)).toEqual(keys(linked.id))
  expect(groupBox(p, linked.id)!.min.x).toBe(groupBox(p, gid)!.max.x + 2)
})

function linkedPair() {
  const d = drawer()
  let p = ok(groupBoards(d.p, [d.left, d.right, d.bottom], 'Drawer')).project
  const a = p.groups![0].id
  const r = ok(copyGroup(p, a, true))
  p = r.project
  const twin = (id: string) => p.boards.find(b => b.link === board(p, id).link && b.id !== id)!.id
  return { ...d, p, a, b: r.id, twin }
}

test('a size, wood or feature change in one linked copy happens in the other', () => {
  const t = linkedPair()
  const bottom2 = t.twin(t.bottom)
  let p = syncLinks(t.p, updateBoard(t.p, t.bottom, { width: 7, holes: [{ diameter: 0.5, u: 1, v: 1 }] }))
  expect(board(p, bottom2).width).toBe(7)
  expect(board(p, bottom2).holes).toHaveLength(1)
  // Its place is its own.
  expect(board(p, bottom2).position.x).not.toBe(board(p, t.bottom).position.x)
  const prev = p
  p = syncLinks(prev, { ...prev, boards: prev.boards.map(b => (b.id === t.bottom ? { ...b, formulas: { width: 'W', x: '3' } } : b)) })
  expect(board(p, bottom2).formulas).toEqual({ width: 'W' })
})

test('moving one part inside a linked copy moves it in the other; moving a whole copy does not', () => {
  const t = linkedPair()
  const left2 = t.twin(t.left)
  const b0 = board(t.p, t.left)
  let p = syncLinks(t.p, moveBoard(t.p, t.left, { ...b0.position, z: b0.position.z + 1 }))
  expect(board(p, left2).position.z).toBe(board(t.p, left2).position.z + 1)
  const before = p
  p = syncLinks(before, moveGroup(before, t.a, 'y', 30))
  expect(board(p, left2).position.y).toBe(board(before, left2).position.y)
})

test('joints added, changed and removed in one linked copy follow in the other', () => {
  const t = linkedPair()
  const after = ok(addJoint(t.p, 'dado', t.left, t.bottom) as unknown as { project: Project } | { error: string })
  let p = syncLinks(t.p, after.project)
  expect(p.joints.filter(j => j.type === 'dado')).toHaveLength(2)
  // The dado lengthened the bottom in both.
  expect(board(p, t.twin(t.bottom)).width).toBe(board(p, t.bottom).width)
  const j = p.joints.find(x => x.type === 'dado' && (x.hostBoardId === t.left || x.partnerBoardId === t.left))!
  let prev = p
  p = syncLinks(prev, updateJoint(prev, j.id, { depth: 0.375 }))
  expect(p.joints.filter(x => x.type === 'dado').map(x => (x.params as { depth: number }).depth)).toEqual([0.375, 0.375])
  expect(board(p, t.twin(t.bottom)).width).toBe(board(p, t.bottom).width)
  prev = p
  p = syncLinks(prev, removeJoint(prev, j.id))
  expect(p.joints.filter(x => x.type === 'dado')).toHaveLength(0)
  expect(board(p, t.twin(t.bottom)).width).toBe(board(p, t.bottom).width)
})

test('deleting a part from one linked copy deletes it from the other; deleting a whole copy leaves the other', () => {
  const t = linkedPair()
  const right2 = t.twin(t.right)
  let p = pruneGroups(syncLinks(t.p, deleteBoards(t.p, [t.right])))
  expect(p.boards.some(b => b.id === right2)).toBe(false)
  const ids = groupBoardIds(p, t.b)
  p = pruneGroups(syncLinks(p, deleteBoards(p, ids)))
  expect(groupBoardIds(p, t.a)).toHaveLength(2)
})

test('unlink makes a copy independent; the last one left loses its link too', () => {
  const t = linkedPair()
  let p = unlinkGroup(t.p, t.b)
  expect(p.groups!.every(g => !g.link)).toBe(true)
  expect(p.boards.every(b => !b.link)).toBe(true)
  p = syncLinks(p, updateBoard(p, t.bottom, { width: 9 }))
  expect(board(p, t.twin === undefined ? t.bottom : t.bottom).width).toBe(9)
  expect(p.boards.filter(b => b.name === 'Bottom').map(b => b.width).sort()).toEqual([5.5, 9])
})

test('files: v4 opens as v5; groups round-trip; damaged group references are cleaned on open', async () => {
  const { deserialize, serialize, FORMAT_VERSION } = await import('../../src/model/fileFormat')
  expect(FORMAT_VERSION).toBeGreaterThanOrEqual(5)
  const t = linkedPair()
  const back = deserialize(serialize(t.p))
  expect(back.groups).toEqual(t.p.groups)
  expect(back.boards.map(b => [b.groupId, b.link])).toEqual(t.p.boards.map(b => [b.groupId, b.link]))
  const raw = JSON.parse(serialize(t.p))
  raw.formatVersion = 4
  raw.boards[0].groupId = 'gone'
  const opened = deserialize(JSON.stringify(raw))
  expect(opened.formatVersion).toBe(FORMAT_VERSION)
  expect(opened.boards[0].groupId).toBeUndefined()
  raw.groups[0].name = 7
  expect(() => deserialize(JSON.stringify(raw))).toThrow('a group is damaged')
})

test('linked copies are numbered: Drawer, Drawer 2, Drawer 3', () => {
  const t = linkedPair()
  expect(t.p.groups!.find(g => g.id === t.b)!.name).toBe('Drawer 2')
  const r = ok(copyGroup(t.p, t.b, true))
  expect(r.project.groups!.find(g => g.id === r.id)!.name).toBe('Drawer 3')
})

// ── final review ──────────────────────────────────────────────────────────
import { alignBoards, duplicateBoards, mirrorBoards } from '../../src/model/ops'

test('a duplicated linked part is a plain part (no link), so it drags nothing with it', () => {
  const t = linkedPair()
  const r = duplicateBoards(t.p, [t.bottom])
  const p = syncLinks(t.p, r.project)
  expect(board(p, r.ids[0]).link).toBeUndefined()
  const b2 = t.twin(t.bottom)
  const q = syncLinks(p, updateBoard(p, r.ids[0], { width: 3 }))
  expect(board(q, b2).width).toBe(5.5)
})

test('one edit that moves a part in both copies moves each once, not twice', () => {
  const t = linkedPair()
  const b2 = t.twin(t.bottom)
  const z = (p: Project, id: string) => board(p, id).position.z
  const edited = { ...t.p, boards: t.p.boards.map(b => (b.id === t.bottom || b.id === b2 ? { ...b, position: { ...b.position, z: b.position.z + 1 } } : b)) }
  const p = syncLinks(t.p, edited)
  expect(z(p, t.bottom)).toBe(z(t.p, t.bottom) + 1)
  expect(z(p, b2)).toBe(z(t.p, b2) + 1)
  // Moving one part inside a copy moves it in the other (the copies share their layout).
  const q = syncLinks(t.p, moveBoard(t.p, t.bottom, { ...board(t.p, t.bottom).position, z: 2 }))
  expect(z(q, b2)).toBe(2)
})

test('mirroring a whole copy changes only that copy', () => {
  const t = linkedPair()
  const p = { ...t.p, boards: t.p.boards.map(b => ({ ...b, endCuts: { start: { miter: 30, bevel: 0 }, end: { miter: 0, bevel: 0 } } })) }
  const after = syncLinks(p, mirrorBoards(p, groupBoardIds(p, t.b), 'x'))
  expect(groupBoardIds(after, t.a).map(id => board(after, id).endCuts.start.miter)).toEqual([30, 30, 30])
})

test('deleting a joint host in one copy moves the partner once in the other', () => {
  const t = linkedPair()
  const j = ok(addJoint(t.p, 'dado', t.left, t.bottom) as unknown as { project: Project } | { error: string })
  const p = pruneGroups(syncLinks(t.p, j.project))
  const l2 = t.twin(t.left)
  const q = pruneGroups(syncLinks(p, deleteBoards(p, [t.bottom])))
  const rel = (pr: Project, id: string, other: string) => [board(pr, id).position.z, board(pr, id).width, board(pr, other).position.z]
  expect(rel(q, l2, l2)[0] - rel(p, l2, l2)[0]).toBeCloseTo(board(q, t.left).position.z - board(p, t.left).position.z)
  expect(board(q, l2).width).toBe(board(q, t.left).width)
})

test('a turned copy follows a resize in its own frame (a dado seats both sides)', () => {
  const t = linkedPair()
  let p = syncLinks(t.p, rotateGroup(t.p, t.b, 'x', 90))
  const b2 = t.twin(t.bottom), l2 = t.twin(t.left)
  const j = ok(addJoint(p, 'dado', t.left, t.bottom) as unknown as { project: Project } | { error: string })
  p = syncLinks(p, j.project)
  const shared = (a: string, b: string) => {
    const A = worldBox(board(p, a)), C = worldBox(board(p, b))
    return (['x', 'y', 'z'] as const).map(k => Math.max(0, Math.min(A.max[k], C.max[k]) - Math.max(A.min[k], C.min[k])))
  }
  const s1 = shared(t.bottom, t.left).filter(v => v > 0).length, s2 = shared(b2, l2).filter(v => v > 0).length
  expect(s2).toBe(s1)
})

test('a linked copy inside (or around) a linked copy is refused with a plain message', () => {
  const d = drawer()
  let p = ok(groupBoards(d.p, [d.left, d.right], 'Sides')).project
  p = ok(groupBoards(p, [d.left, d.right, d.bottom], 'Drawer')).project
  const drawerId = p.groups!.find(g => g.name === 'Drawer')!.id
  const sidesId = p.groups!.find(g => g.name === 'Sides')!.id
  p = ok(copyGroup(p, drawerId, true)).project
  expect(copyGroup(p, sidesId, true)).toEqual({ error: "Linked copies inside a linked copy aren't supported yet" })
  expect('error' in copyGroup(p, sidesId, false)).toBe(false)
})

test('linked-copy names count up from the highest; a lone instance loses its link', () => {
  const t = linkedPair()
  let p = pruneGroups(deleteBoards(t.p, groupBoardIds(t.p, t.b)))
  expect(p.groups!.every(g => !g.link)).toBe(true)
  expect(p.boards.every(b => !b.link)).toBe(true)
  const r1 = ok(copyGroup(p, t.a, true)); p = r1.project
  const r2 = ok(copyGroup(p, t.a, true)); p = r2.project
  p = pruneGroups(deleteBoards(p, groupBoardIds(p, r1.id)))
  const r3 = ok(copyGroup(p, t.a, true))
  expect(r3.project.groups!.map(g => g.name).sort()).toEqual(['Drawer', 'Drawer 3', 'Drawer 4'])
})

test('Duplicate on a whole group copies the group; on parts copies the parts', async () => {
  const { duplicateSelection } = await import('../../src/assemblies/ops')
  const t = linkedPair()
  const all = groupBoardIds(t.p, t.a)
  const r = duplicateSelection(t.p, all)
  expect(r.ids).toHaveLength(3)
  expect(r.project.groups!.map(g => g.name)).toContain('Drawer (copy)')
  expect(r.ids.every(id => !board(r.project, id).link)).toBe(true)
  expect(duplicateSelection(t.p, all, false).project.groups).toHaveLength(2)
})
