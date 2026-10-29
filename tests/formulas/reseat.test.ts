import { boxInLocal, worldBox } from '../../src/model/geometry'
import type { GrooveParams, Project } from '../../src/model/types'
import { validate } from '../../src/model/validate'
import { emptyProject } from '../../src/model/woods'
import { setBoardFormula, setJointFormula } from '../../src/formulas/ops'
import { recalc } from '../../src/formulas/recalc'
import { addRule } from '../../src/formulas/rules'
import { applyTemplate, unlock } from '../../src/templates'

const ok = (r: Project | { error: string }): Project => { if ('error' in r) throw new Error(r.error); return r }
const shelfPlain = (): Project => {
  const p = unlock(applyTemplate(emptyProject('S'), 'bookshelf', { shelves: 3, back: true }))
  return { ...p, sizes: [], rules: [] }
}
const by = (p: Project, name: string) => p.boards.filter(b => b.name === name)

test('a shelf moved by a rule takes its dados with it', () => {
  let p = shelfPlain()
  const shelf = by(p, 'Shelf')[0], bottom = by(p, 'Bottom')[0]
  p = ok(addRule(p, { kind: 'gap', axis: 'z', part: shelf.id, to: bottom.id, side: 'max', gap: 4 }))
  const q = recalc(p).project
  const dados = q.joints.filter(j => j.partnerBoardId === shelf.id)
  expect(dados).toHaveLength(2)
  for (const j of dados) {
    const host = q.boards.find(b => b.id === j.hostBoardId)!
    const pl = boxInLocal(host, worldBox(q.boards.find(b => b.id === shelf.id)!))
    expect((j.params as GrooveParams).offset).toBe(pl.min.y)
  }
  expect(validate(q).filter(w => /no longer lines up/.test(w.message))).toEqual([])
})

test('the back\'s rabbets follow when the sides get deeper', () => {
  let p = shelfPlain()
  const back = by(p, 'Back')[0]
  for (const s of by(p, 'Side')) p = setBoardFormula(p, s.id, 'width', '=12')
  p = setBoardFormula(p, back.id, 'y', '=12 - 1/4')
  const q = recalc(p).project
  const rabbets = q.joints.filter(j => j.type === 'rabbet')
  expect(rabbets.map(j => (j.params as GrooveParams).offset)).toEqual([11.75, 11.75])
  expect(validate(q).filter(w => /no longer lines up/.test(w.message))).toEqual([])
})

test('a groove offset with its own formula keeps it', () => {
  let p = shelfPlain()
  const shelf = by(p, 'Shelf')[0], bottom = by(p, 'Bottom')[0]
  const j = p.joints.find(x => x.partnerBoardId === shelf.id)!
  p = setJointFormula(p, j.id, 'offset', '=10')
  p = ok(addRule(p, { kind: 'gap', axis: 'z', part: shelf.id, to: bottom.id, side: 'max', gap: 4 }))
  const q = recalc(p).project
  expect((q.joints.find(x => x.id === j.id)!.params as GrooveParams).offset).toBe(10)
})

test('a joint whose parts no longer meet is left alone, with the usual warning', () => {
  let p = shelfPlain()
  const shelf = by(p, 'Shelf')[0]
  const before = p.joints.filter(j => j.partnerBoardId === shelf.id).map(j => j.params)
  p = setBoardFormula(p, shelf.id, 'z', '=200')
  const q = recalc(p).project
  expect(q.joints.filter(j => j.partnerBoardId === shelf.id).map(j => j.params)).toEqual(before)
  expect(validate(q).some(w => /no longer lines up/.test(w.message))).toBe(true)
})
