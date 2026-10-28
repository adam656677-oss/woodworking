import { cutList } from '../../src/model/cutlist'
import { worldBox } from '../../src/model/geometry'
import {
  addBoard, addJoint, alignBoards, deleteBoards, duplicateBoards, mirrorBoards, moveBoard, removeJoint,
  renameBoard, rotateBoard, setEdgeBevel, setEndCut, updateBoard, updateJoint
} from '../../src/model/ops'
import type { Project } from '../../src/model/types'
import { validate } from '../../src/model/validate'
import { emptyProject } from '../../src/model/woods'
import { applyTemplate } from '../../src/templates'
import { board, project } from './helpers'

const get = (p: Project, id: string) => p.boards.find(b => b.id === id)!

describe('addBoard and simple edits', () => {
  test('defaults come from the wood', () => {
    const { project: p, id } = addBoard(emptyProject('X'), { woodId: '1x4' })
    expect(get(p, id)).toMatchObject({ thickness: 0.75, width: 3.5, length: 12, grain: 'length', position: { x: 0, y: 0, z: 0 } })
    const { project: p2, id: id2 } = addBoard(emptyProject('X'), { woodId: 'ply-3-4' })
    expect(get(p2, id2).width).toBe(6)
  })
  test('sizes and moves snap to 1/64', () => {
    let { project: p, id } = addBoard(emptyProject('X'), { woodId: '1x4' })
    p = updateBoard(p, id, { length: 10.001 })
    expect(get(p, id).length).toBe(10)
    p = moveBoard(p, id, { x: 1.0001, y: 2, z: 3 })
    expect(get(p, id).position).toEqual({ x: 1, y: 2, z: 3 })
  })
  test('operations never mutate the input', () => {
    const { project: p, id } = addBoard(emptyProject('X'), { woodId: '1x4' })
    const before = JSON.stringify(p)
    renameBoard(p, id, 'Leg')
    moveBoard(p, id, { x: 5, y: 0, z: 0 })
    expect(JSON.stringify(p)).toBe(before)
    expect(get(renameBoard(p, id, 'Leg'), id).name).toBe('Leg')
  })
})

describe('rotate, duplicate, mirror, align', () => {
  test('rotating 90° about z swaps the world footprint and keeps the center', () => {
    const p = project([board({ id: 'a', width: 4, length: 10 })])
    const before = worldBox(get(p, 'a'))
    const after = worldBox(get(rotateBoard(p, 'a', 'z', 90), 'a'))
    expect(after.max.x - after.min.x).toBeCloseTo(before.max.y - before.min.y)
    expect(after.max.y - after.min.y).toBeCloseTo(before.max.x - before.min.x)
    expect((after.min.x + after.max.x) / 2).toBeCloseTo((before.min.x + before.max.x) / 2)
  })
  test('duplicate offsets by 1" on x and names the copy', () => {
    const p = project([board({ id: 'a', name: 'Leg' })])
    const { project: q, ids } = duplicateBoards(p, ['a'])
    expect(q.boards).toHaveLength(2)
    expect(get(q, ids[0])).toMatchObject({ name: 'Leg (copy)', position: { x: 1, y: 0, z: 0 } })
  })
  test('mirror keeps the gap and flips miter signs', () => {
    const p = project([
      board({ id: 'a', width: 2, length: 10, endCuts: { start: { miter: 45, bevel: 0 }, end: { miter: 0, bevel: 0 } } }),
      board({ id: 'b', width: 2, length: 10, position: { x: 5, y: 0, z: 0 } })
    ])
    const q = mirrorBoards(p, ['a', 'b'], 'x')
    expect(worldBox(get(q, 'a')).min.x).toBe(5)
    expect(worldBox(get(q, 'b')).min.x).toBe(0)
    expect(get(q, 'a').endCuts.start.miter).toBe(-45)
  })
  test('align to the first selected board', () => {
    const p = project([board({ id: 'a', length: 10 }), board({ id: 'b', length: 4, position: { x: 20, y: 3, z: 0 } })])
    expect(worldBox(get(alignBoards(p, ['a', 'b'], 'y', 'min'), 'b')).min.y).toBe(0)
    expect(worldBox(get(alignBoards(p, ['a', 'b'], 'y', 'max'), 'b')).max.y).toBe(10)
    expect(worldBox(get(alignBoards(p, ['a', 'b'], 'y', 'center'), 'b')).min.y).toBe(3)
  })
})

describe('delete', () => {
  test('deleting a dadoed shelf removes its joints; no dangling references', () => {
    const p = applyTemplate(emptyProject('S'), 'bookshelf')
    const shelf = p.boards.find(b => b.name === 'Shelf')!
    const q = deleteBoards(p, [shelf.id])
    expect(q.joints.some(j => j.hostBoardId === shelf.id || j.partnerBoardId === shelf.id)).toBe(false)
    expect(validate(q)).toEqual([])
    const side = cutList(q).rows.find(r => r.part === 'Side')!
    expect(side.notes.filter(n => n.includes('dado'))).toHaveLength(4)
  })
})

describe('joints change the boards', () => {
  // Free-form: an upright side and a shelf butted against its face.
  const side = board({ id: 'side', thickness: 0.75, width: 10, length: 36, rotation: { x: 90, y: 90, z: 0 } })
  const shelf = board({ id: 'shelf', thickness: 0.75, width: 9, length: 28, position: { x: 0.75, y: 9, z: 10 }, rotation: { x: 0, y: 0, z: -90 } })
  const base = () => project([side, shelf])

  test('adding a dado lengthens the shelf into the groove; removing it restores exactly', () => {
    const r = addJoint(base(), 'dado', 'side', 'shelf')
    if ('error' in r) throw new Error(r.error)
    const s = get(r.project, 'shelf')
    expect(s.length).toBe(28.25)
    expect(worldBox(s).min.x).toBe(0.5)
    const j = r.project.joints[0]
    expect(j.params).toMatchObject({ width: 0.75, depth: 0.25, offset: 10, along: 'width', face: 'top' })
    expect(validate(r.project)).toEqual([])
    const back = removeJoint(r.project, r.id)
    expect(get(back, 'shelf')).toEqual(shelf)
    expect(back.joints).toEqual([])
  })

  test('changing the dado depth from 1/4 to 3/16 shortens the shelf by 1/16', () => {
    const r = addJoint(base(), 'dado', 'side', 'shelf')
    if ('error' in r) throw new Error(r.error)
    const q = updateJoint(r.project, r.id, { depth: 0.1875 })
    expect(get(q, 'shelf').length).toBe(28.1875)
  })

  test('a joint the contact does not offer is refused', () => {
    const a = board({ id: 'a', width: 4, length: 10 })
    const b = board({ id: 'b', width: 4, length: 10, position: { x: 0, y: 0, z: 0.75 } })
    expect(addJoint(project([a, b]), 'dado', 'a', 'b')).toEqual({ error: "A dado can't join these boards" })
    const far = board({ id: 'c', position: { x: 50, y: 0, z: 0 } })
    expect(addJoint(project([a, far]), 'butt', 'a', 'c')).toEqual({ error: "These boards don't touch" })
  })
})

describe('template joints (made without a restore record)', () => {
  test('a shallower template dado shortens just that shelf by 1/16; removing it shortens by the full 1/4', () => {
    const p = applyTemplate(emptyProject('S'), 'bookshelf')
    const shelf = p.boards.find(b => b.name === 'Shelf')!
    const side = p.boards.find(b => b.name === 'Side')!
    const j = p.joints.find(x => x.hostBoardId === side.id && x.partnerBoardId === shelf.id)!
    const q = updateJoint(p, j.id, { depth: 0.1875 })
    expect(get(q, shelf.id).length).toBe(29)
    expect(worldBox(get(q, shelf.id)).max.x).toBe(worldBox(shelf).max.x)
    expect(get(removeJoint(p, j.id), shelf.id).length).toBe(28.8125)
  })
})

describe('picture frame miters', () => {
  // Rails run along x (14"), stiles along y (10") fitted between them: 14 x 14 outside.
  const frame = () => project([
    board({ id: 'r1', name: 'Rail', width: 2, length: 14, rotation: { x: 0, y: 0, z: 90 }, position: { x: 14, y: 0, z: 0 } }),
    board({ id: 'r2', name: 'Rail', width: 2, length: 14, rotation: { x: 0, y: 0, z: 90 }, position: { x: 14, y: 12, z: 0 } }),
    board({ id: 's1', name: 'Stile', width: 2, length: 10, position: { x: 0, y: 2, z: 0 } }),
    board({ id: 's2', name: 'Stile', width: 2, length: 10, position: { x: 12, y: 2, z: 0 } })
  ])
  const corners: [string, string][] = [['r1', 's1'], ['r1', 's2'], ['r2', 's1'], ['r2', 's2']]

  function miterAll(p: Project): { p: Project; ids: string[] } {
    const ids: string[] = []
    for (const [h, s] of corners) {
      const r = addJoint(p, 'miter', h, s)
      if ('error' in r) throw new Error(r.error)
      p = r.project
      ids.push(r.id)
    }
    return { p, ids }
  }

  test('four miters: 45° both ends on every part, outside size unchanged', () => {
    const { p } = miterAll(frame())
    const rows = cutList(p).rows
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ qty: 4, part: 'Rail / Stile', thickness: 0.75, width: 2, length: 14, notes: ['45° miter both ends'] })
    const all = p.boards.map(worldBox)
    expect(Math.min(...all.map(b => b.min.x))).toBe(0)
    expect(Math.max(...all.map(b => b.max.x))).toBe(14)
    expect(Math.max(...all.map(b => b.max.y))).toBe(14)
    expect(validate(p)).toEqual([])
  })

  test('removing the miters in any order restores the original lengths', () => {
    const original = frame()
    const { p, ids } = miterAll(original)
    let q = p
    for (const id of [ids[0], ids[2], ids[1], ids[3]]) q = removeJoint(q, id)
    expect(q.boards).toEqual(original.boards)
  })
})

describe('angled cuts', () => {
  test('setEndCut and setEdgeBevel; steep angles refused', () => {
    const p = project([board({ id: 'a' })])
    const q = setEndCut(p, 'a', 'start', { miter: 22.5 })
    if ('error' in q) throw new Error(q.error)
    expect(get(q, 'a').endCuts.start).toEqual({ miter: 22.5, bevel: 0 })
    const r = setEdgeBevel(p, 'a', 'left', 15)
    if ('error' in r) throw new Error(r.error)
    expect(get(r, 'a').edgeBevels.left).toBe(15)
    expect(setEndCut(p, 'a', 'end', { bevel: 61 })).toEqual({ error: 'Angles must be between 0° and 60°' })
    expect(setEdgeBevel(p, 'a', 'right', -75)).toEqual({ error: 'Angles must be between 0° and 60°' })
  })
})
