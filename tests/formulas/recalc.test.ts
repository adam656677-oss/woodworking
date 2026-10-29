import { worldBox } from '../../src/model/geometry'
import { addBoard, rotateBoard } from '../../src/model/ops'
import type { Project } from '../../src/model/types'
import { emptyProject } from '../../src/model/woods'
import { deleteSize, renameSize, setBoardFormula, setSize } from '../../src/formulas/ops'
import { recalc } from '../../src/formulas/recalc'
import { addEdgeProfile } from '../../src/shaping/edges'
import { turnBoard } from '../../src/shaping/turning'

const ok = (r: Project | { error: string }): Project => { if ('error' in r) throw new Error(r.error); return r }
function two(): { p: Project; a: string; b: string } {
  let p = emptyProject('T')
  const a = addBoard(p, { woodId: '1x6', name: 'Side', width: 5.5, length: 20 }); p = a.project
  const b = addBoard(p, { woodId: '1x6', name: 'Side', width: 5.5, length: 20, position: { x: 10, y: 0, z: 0 } }); p = b.project
  return { p, a: a.id, b: b.id }
}
const errs = (p: Project) => recalc(p).errors.map(e => e.message)
const board = (p: Project, id: string) => p.boards.find(b => b.id === id)!

test('sizes build on sizes; a board width follows =W/2', () => {
  let { p, a } = two()
  p = ok(setSize(p, 'W', '30'))
  p = ok(setSize(p, 'Half', '=W/2'))
  p = setBoardFormula(p, a, 'width', '=Half - 1/4')
  const r = recalc(p)
  expect(r.errors).toEqual([])
  expect(board(r.project, a).width).toBe(14.75)
  p = ok(setSize(r.project, 'W', '20'))
  expect(board(recalc(p).project, a).width).toBe(9.75)
})

test('an X formula places the low corner, even on a turned-around board', () => {
  let { p, a } = two()
  p = rotateBoard(p, a, 'z', 90)
  p = setBoardFormula(p, a, 'x', '=2 + 1/2')
  const q = recalc(p).project
  expect(worldBox(board(q, a)).min.x).toBe(2.5)
})

test('Side#2 is the second Side', () => {
  let { p, a } = two()
  p = setBoardFormula(p, a, 'length', '=Side#2.Length + 1')
  expect(board(recalc(p).project, a).length).toBe(21)
})

test('a loop is reported and the value kept', () => {
  let { p, a } = two()
  p = ok(setSize(ok(setSize(p, 'A', '=B + 1')), 'B', '=A + 1'))
  p = setBoardFormula(p, a, 'width', '=A')
  const r = recalc(p)
  expect(r.errors.map(e => e.message)).toContain('These sizes depend on each other: A → B → A')
  expect(board(r.project, a).width).toBe(5.5)
})

test('a size must come out more than 0; a position may be anything', () => {
  let { p, a } = two()
  p = setBoardFormula(p, a, 'width', '=1 - 3')
  p = setBoardFormula(p, a, 'x', '=-4')
  const r = recalc(p)
  expect(r.errors.map(e => e.message)).toEqual(['Width works out to -2" — it must be more than 0"'])
  expect(worldBox(board(r.project, a)).min.x).toBe(-4)
})

test('renaming a size rewrites the formulas that use it, and only those', () => {
  let { p, a } = two()
  p = ok(setSize(ok(setSize(p, 'H', '36')), 'Hx', '2'))
  p = setBoardFormula(p, a, 'length', '=H - 2*Hx + h')
  p = ok(renameSize(p, 'H', 'Height'))
  expect(board(p, a).formulas!.length).toBe('Height - 2*Hx + Height')
  expect(board(recalc(p).project, a).length).toBe(68)
})

test('a size that is used can\'t be deleted; the message says where', () => {
  let { p, a } = two()
  p = ok(setSize(p, 'H', '36'))
  p = setBoardFormula(p, a, 'length', '=H')
  expect(deleteSize(p, 'H')).toEqual({ error: 'H is used by: Side (Length)' })
  expect(ok(deleteSize(setBoardFormula(p, a, 'length', null), 'H')).sizes).toEqual([])
})

test('a renamed part breaks the formula plainly; the value stays', () => {
  let { p, a, b } = two()
  p = setBoardFormula(p, a, 'length', '=Side#2.Length + 1')
  p = { ...p, boards: p.boards.map(x => (x.id === b ? { ...x, name: 'End' } : x)) }
  const r = recalc(p)
  expect(r.errors.map(e => e.message)).toEqual(["Unknown size 'Side#2.Length'"])
  expect(board(r.project, a).length).toBe(20)
})

test('no formulas: the same project comes back', () => {
  const { p } = two()
  expect(recalc(p).project).toBe(p)
})

test('a turning size and an edge profile size follow their formulas', () => {
  const r0 = addBoard(emptyProject('T'), { woodId: '2x2', name: 'Leg', width: 1.5, length: 29 })
  const t = turnBoard(r0.project, r0.id, { style: 'vase', top: 5 })
  if ('error' in t) throw new Error(t.error)
  let p = ok(addEdgeProfile(t.project, r0.id, { profile: 'chamfer', size: 0.125, face: 'top', sides: ['end'] }))
  p = ok(setSize(p, 'Apron', '4'))
  p = setBoardFormula(p, r0.id, 'turning.top', '=Apron + 1/2')
  p = setBoardFormula(p, r0.id, 'edges.0.size', '=1/4')
  const q = recalc(p).project
  expect(board(q, r0.id).turning!.top).toBe(4.5)
  expect(board(q, r0.id).edges![0].size).toBe(0.25)
  expect(errs(p)).toEqual([])
})
