import { cutList } from '../../src/model/cutlist'
import { deserialize, ProjectFileError, serialize } from '../../src/model/fileFormat'
import { worldBox } from '../../src/model/geometry'
import { addJoint, changeWood, deleteBoards, moveBoard, updateBoard } from '../../src/model/ops'
import type { Project } from '../../src/model/types'
import { formatInches } from '../../src/model/units'
import { validate } from '../../src/model/validate'
import { emptyProject } from '../../src/model/woods'
import { applyTemplate } from '../../src/templates'
import { board, project } from './helpers'

const get = (p: Project, id: string) => p.boards.find(b => b.id === id)!

describe('I5: damaged values never crash', () => {
  test('formatInches of a non-number shows a placeholder instead of overflowing', () => {
    expect(formatInches(NaN)).toBe('?"')
    expect(formatInches(Infinity)).toBe('?"')
  })
  test('formatInches can show 1/64ths when asked', () => {
    expect(formatInches(15 / 64, { sixtyFourths: true })).toBe('15/64"')
    expect(formatInches(15 / 64)).toBe('1/4"')
  })
  test('joints with damaged params, bad holes, bad grain or unknown types are rejected on open', () => {
    const base = JSON.parse(serialize(applyTemplate(emptyProject('S'), 'bookshelf')))
    const variants: ((r: any) => void)[] = [
      r => { r.joints[0].params = {} },
      r => { r.joints[0].type = 'dovetail' },
      r => { r.boards[0].holes = [{}] },
      r => { r.boards[0].grain = 'sideways' }
    ]
    for (const v of variants) {
      const r = structuredClone(base)
      v(r)
      let err: unknown
      try { deserialize(JSON.stringify(r)) } catch (e) { err = e }
      expect(err).toBeInstanceOf(ProjectFileError)
      expect((err as ProjectFileError).code).toBe('invalid')
    }
  })
})

describe('I1: changeWood only carries full width between dimensional lumber', () => {
  test('lumber → sheet keeps the width', () => {
    const p = project([board({ id: 'a', woodId: '1x10', width: 9.25, length: 24 })])
    expect(get(changeWood(p, 'a', 'ply-1-2'), 'a')).toMatchObject({ width: 9.25, thickness: 0.46875 })
    expect(get(changeWood(p, 'a', 'hw-4-4'), 'a').width).toBe(9.25)
    expect(get(changeWood(p, 'a', '1x4'), 'a').width).toBe(3.5)
  })
})

describe('I3: deleting a board undoes what its joints did to the other board', () => {
  test('deleting one side of a dadoed shelf shortens the shelf back', () => {
    const side = board({ id: 'side', thickness: 0.75, width: 10, length: 36, rotation: { x: 90, y: 90, z: 0 } })
    const shelf = board({ id: 'shelf', thickness: 0.75, width: 9, length: 28, position: { x: 0.75, y: 9, z: 10 }, rotation: { x: 0, y: 0, z: -90 } })
    const r = addJoint(project([side, shelf]), 'dado', 'side', 'shelf')
    if ('error' in r) throw new Error(r.error)
    expect(get(deleteBoards(r.project, ['side']), 'shelf')).toEqual(shelf)
  })
})

describe('I2: a joint that no longer lines up is flagged', () => {
  test('moving a dadoed shelf away from its groove warns', () => {
    const p = applyTemplate(emptyProject('S'), 'bookshelf')
    const shelf = p.boards.find(b => b.name === 'Shelf')!
    const moved = moveBoard(p, shelf.id, { ...shelf.position, z: shelf.position.z + 3 })
    const w = validate(moved)
    expect(w.some(x => x.kind === 'badJoint' && x.boardIds.includes(shelf.id) && /no longer lines up/.test(x.message))).toBe(true)
    expect(validate(p)).toEqual([])
  })
  test('a joined pair pushed into each other beyond the groove depth warns', () => {
    const p = applyTemplate(emptyProject('S'), 'bookshelf')
    const shelf = p.boards.find(b => b.name === 'Shelf')!
    const moved = updateBoard(p, shelf.id, { length: shelf.length + 1 })
    expect(validate(moved).some(x => x.boardIds.includes(shelf.id) && /no longer lines up/.test(x.message))).toBe(true)
  })
})

describe('I6: parts are grouped the way they can be flipped in the shop; true mirror pairs are flagged', () => {
  test('bookshelf sides with evenly spaced dados are interchangeable (turn one end-for-end)', () => {
    const rows = cutList(applyTemplate(emptyProject('S'), 'bookshelf')).rows.filter(r => r.part === 'Side')
    expect(rows.map(r => r.qty)).toEqual([2])
    expect(rows[0].notes.some(n => /Mirror pair/.test(n))).toBe(false)
  })
  test('sides with an off-center dado and a back rabbet are a mirror pair', () => {
    const mk = (id: string, face: 'top' | 'bottom') => board({ id, name: 'Side', width: 10, length: 36 })
    const g = (id: string, host: string, face: 'top' | 'bottom', params: { offset: number }) => ({ id, type: 'dado' as const, hostBoardId: host, partnerBoardId: 'shelf', params: { width: 0.75, depth: 0.25, face, ...params } })
    const r = (id: string, host: string, face: 'top' | 'bottom') => ({ id, type: 'rabbet' as const, hostBoardId: host, partnerBoardId: 'back', params: { width: 0.25, depth: 0.25, offset: 9.75, face, along: 'length' as const } })
    const p = project(
      [mk('L', 'top'), mk('R', 'bottom'), board({ id: 'shelf', name: 'Shelf', position: { x: 50, y: 0, z: 0 } }), board({ id: 'back', name: 'Back', position: { x: 80, y: 0, z: 0 } })],
      [g('d1', 'L', 'top', { offset: 6 }), g('d2', 'R', 'bottom', { offset: 6 }), r('r1', 'L', 'top'), r('r2', 'R', 'bottom')]
    )
    const sides = cutList(p).rows.filter(x => x.part === 'Side')
    expect(sides.map(x => x.qty)).toEqual([1, 1])
    for (const x of sides) expect(x.notes).toContain('Mirror pair with the other Side — grooves on the opposite face')
  })
  test('a side flipped end-for-end (dado measured from the other end) groups with its twin', () => {
    const a = board({ id: 'a', name: 'Side', width: 10, length: 36 })
    const b = board({ id: 'b', name: 'Side', width: 10, length: 36, position: { x: 50, y: 0, z: 0 } })
    const s = board({ id: 'shelf', name: 'Shelf', position: { x: 90, y: 0, z: 0 } })
    const d = (id: string, host: string, offset: number, face: 'top' | 'bottom') => ({ id, type: 'dado' as const, hostBoardId: host, partnerBoardId: 'shelf', params: { width: 0.75, depth: 0.25, offset, face } })
    const rows = cutList(project([a, b, s], [d('1', 'a', 6, 'top'), d('2', 'b', 29.25, 'bottom')])).rows.filter(x => x.part === 'Side')
    expect(rows.map(x => x.qty)).toEqual([2])
  })
})

describe('I7 and box minimums: templates never produce impossible parts', () => {
  test('a bookshelf in 1/2" plywood has no warnings', () => {
    expect(validate(applyTemplate(emptyProject('S'), 'bookshelf', { wood: 'ply-1-2' }))).toEqual([])
  })
  test('a 2" box in 8/4 has no negative sizes', () => {
    const p = applyTemplate(emptyProject('B'), 'box', { W: 2, D: 2, wood: 'hw-8-4' })
    for (const b of p.boards) {
      expect(b.width).toBeGreaterThan(0)
      expect(b.length).toBeGreaterThan(0)
    }
    expect(p.template!.params.W).toBeGreaterThan(2 * 1.75)
  })
  test('the too-deep warning shows the real limit to 1/64"', () => {
    const p = applyTemplate(emptyProject('S'), 'bookshelf', { wood: 'ply-1-2' })
    const j = p.joints.find(x => x.type === 'dado')!
    const bad = { ...p, joints: p.joints.map(x => (x.id === j.id ? { ...x, params: { ...x.params, depth: 0.25 } } : x)) }
    expect(validate(bad).find(w => /deeper than half/.test(w.message))!.message).toContain('15/64" max')
  })
})

test('worldBox sanity for imports', () => {
  expect(worldBox(board({ id: 'x' })).max.z).toBe(0.75)
})
