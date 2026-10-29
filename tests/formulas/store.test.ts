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
