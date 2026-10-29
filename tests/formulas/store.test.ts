import { setBoardFormula, setSize } from '../../src/formulas/ops'
import { createStudioStore } from '../../src/ui/store'
import { addBoard } from '../../src/model/ops'
import type { Project } from '../../src/model/types'

const ok = (r: Project | { error: string }): Project => { if ('error' in r) throw new Error(r.error); return r }

function store() {
  ;(globalThis as any).window = (globalThis as any).window ?? {}
  const s = createStudioStore()
  s.getState().newBlank()
  let id = ''
  s.getState().apply(p => { const r = addBoard(p, { woodId: '1x6', name: 'Rail', width: 5.5, length: 20 }); id = r.id; return r.project })
  return { s, id }
}
const rail = (s: ReturnType<typeof store>['s'], id: string) => s.getState().project.boards.find(b => b.id === id)!

test('changing a size recalculates the parts that use it', () => {
  const { s, id } = store()
  s.getState().apply(p => setBoardFormula(ok(setSize(p, 'W', '30')), id, 'length', '=W - 2'))
  expect(rail(s, id).length).toBe(28)
  s.getState().apply(p => ok(setSize(p, 'W', '40')))
  expect(rail(s, id).length).toBe(38)
})

test('undo puts every dependent part back', () => {
  const { s, id } = store()
  s.getState().apply(p => setBoardFormula(ok(setSize(p, 'W', '30')), id, 'length', '=W - 2'))
  s.getState().apply(p => ok(setSize(p, 'W', '40')))
  s.getState().undo()
  expect(rail(s, id).length).toBe(28)
  s.getState().redo()
  expect(rail(s, id).length).toBe(38)
})

test('a formula problem shows on its box and in the warnings', () => {
  const { s, id } = store()
  s.getState().apply(p => setBoardFormula(p, id, 'width', '=Hight'))
  expect(s.getState().formulaErrors[`board:${id}:width`]).toBe("Unknown size 'Hight'")
  expect(s.getState().warnings.map(w => w.message)).toContain("Unknown size 'Hight'")
  expect(rail(s, id).width).toBe(5.5)
})

test('a live template refuses formulas on its parts', () => {
  const s = createStudioStore()
  s.getState().newFromTemplate('box')
  const id = s.getState().project.boards[0].id
  s.getState().apply(p => setBoardFormula(p, id, 'width', '=4'))
  expect(s.getState().error).toMatch(/live template/)
  expect(s.getState().project.boards[0].formulas).toBeUndefined()
})

test('a change made by another tool (a joint shortening a part) is kept as a nudge on its formula', () => {
  const { s, id } = store()
  s.getState().apply(p => setBoardFormula(ok(setSize(p, 'W', '30')), id, 'length', '=W - 2'))
  s.getState().apply(p => ({ ...p, boards: p.boards.map(b => (b.id === id ? { ...b, length: b.length - 1 / 16 } : b)) }))
  expect(rail(s, id).length).toBe(28 - 1 / 16)
  expect(rail(s, id).formulas?.length).toBe('(W - 2) - 1/16')
  s.getState().apply(p => ok(setSize(p, 'W', '40')))
  expect(rail(s, id).length).toBe(38 - 1 / 16)
})

test("in the kids' designer a typed size or move wins over a formula or rule (it replaces it)", async () => {
  const { moveBoard } = await import('../../src/model/ops')
  const { worldBox } = await import('../../src/model/geometry')
  const { addRule } = await import('../../src/formulas/rules')
  const { s, id } = store()
  let post = ''
  s.getState().apply(p => { const r = addBoard(p, { woodId: '1x6', name: 'Post', width: 5.5, length: 20, position: { x: 40, y: 0, z: 0 } }); post = r.id; return r.project })
  s.getState().apply(p => setBoardFormula(ok(setSize(p, 'W', '30')), id, 'length', '=W - 2'))
  s.getState().apply(p => ok(addRule(p, { kind: 'gap', axis: 'x', part: post, to: id, side: 'max', gap: 1 })))
  s.setState({ kidsMode: true })
  s.getState().apply(p => ({ ...p, boards: p.boards.map(b => (b.id === id ? { ...b, length: 12 } : b)) }))
  expect(rail(s, id).length).toBe(12)
  expect(rail(s, id).formulas?.length).toBeUndefined()
  s.getState().apply(p => { const b = p.boards.find(x => x.id === post)!; return moveBoard(p, post, { ...b.position, x: b.position.x + 30 }) })
  expect(s.getState().project.rules ?? []).toEqual([])
  expect(worldBox(rail(s, post)).min.x).toBeGreaterThan(30)
})

test("a template opened in the kids' designer opens as plain parts, without formulas", async () => {
  const { freeze } = await import('../../src/templates')
  const { applyTemplate } = await import('../../src/templates')
  const { emptyProject } = await import('../../src/model/woods')
  const p = freeze(applyTemplate(emptyProject('T'), 'bookshelf', {}))
  expect(p.template).toBeUndefined()
  expect(p.sizes).toBeUndefined()
  expect(p.rules).toBeUndefined()
  expect(p.boards.some(b => b.formulas)).toBe(false)
})
