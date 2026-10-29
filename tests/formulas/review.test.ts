import { worldBox } from '../../src/model/geometry'
import type { Project } from '../../src/model/types'
import { emptyProject } from '../../src/model/woods'
import { setBoardFormula, setSize } from '../../src/formulas/ops'
import { recalc } from '../../src/formulas/recalc'
import { applyTemplate, unlock } from '../../src/templates'

const ok = (r: Project | { error: string }): Project => { if ('error' in r) throw new Error(r.error); return r }

test("a part's position formula waits for its own size formulas (one pass is enough)", () => {
  let p = unlock(applyTemplate(emptyProject('T'), 'bookshelf', {}))
  const shelf = p.boards[4]
  p = setBoardFormula(p, shelf.id, 'y', '2')
  p = { ...p, boards: p.boards.map(b => (b.id === shelf.id ? { ...b, formulas: { y: '2', ...b.formulas } } : b)) }
  p = recalc(p).project
  p = recalc(ok(setSize(p, 'D', '14'))).project
  expect(worldBox(p.boards.find(b => b.id === shelf.id)!).min.y).toBe(2)
})

test('a bookshelf unlocked with no shelves has no Shelves size (nothing would use it)', () => {
  const p = unlock(applyTemplate(emptyProject('T'), 'bookshelf', { shelves: 0 }))
  expect(p.sizes!.map(s => s.name)).not.toContain('Shelves')
  expect(p.rules ?? []).toEqual([])
})

test('a groove width or offset typed as a number stays put in a project with formulas', async () => {
  const { setGrooveValue } = await import('../../src/formulas/ops')
  let p = unlock(applyTemplate(emptyProject('T'), 'bookshelf', {}))
  const j = p.joints[4]
  p = recalc(ok(setGrooveValue(p, j.id, 'width', 49 / 64))).project
  p = recalc(ok(setGrooveValue(p, j.id, 'offset', 10))).project
  const g = p.joints.find(x => x.id === j.id)!.params as { width: number; offset: number }
  expect([g.width, g.offset]).toEqual([49 / 64, 10])
})

test('a groove depth formula moves a partner without a length formula into the groove; one with a formula keeps it', async () => {
  const { setJointFormula } = await import('../../src/formulas/ops')
  let p = unlock(applyTemplate(emptyProject('T'), 'bookshelf', {}))
  p = recalc(ok(setSize(p, 'Dd', '1/4'))).project
  const j = p.joints[4]
  const shelf = () => p.boards.find(b => b.id === j.partnerBoardId)!
  const withFormula = shelf().length
  // With its length formula the shelf follows that formula only (it already counts the dado depth).
  p = recalc(setJointFormula(p, j.id, 'depth', 'Dd')).project
  expect(shelf().length).toBe(withFormula)
  // Without one, a deeper groove lengthens it by the difference.
  p = { ...p, boards: p.boards.map(b => (b.id === j.partnerBoardId ? { ...b, formulas: undefined } : b)) }
  p = recalc(ok(setSize(p, 'Dd', '3/8'))).project
  expect((p.joints.find(x => x.id === j.id)!.params as { depth: number }).depth).toBe(3 / 8)
  expect(shelf().length).toBe(withFormula + 1 / 8)
})
