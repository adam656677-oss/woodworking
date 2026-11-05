// Model-level performance guard: a full kitchen (16 cabinets, ~350 parts, ~670 joints) must stay quick to open,
// edit, check and plan. Budgets are generous (about ten times what a developer laptop needs, scaled up on slow
// machines by `slowness()`), so they catch a return of the old O(n^2) work, not a noisy runner.
import { clearance } from '../../src/cabinet/motion'
import { clearSharedVolumes, interferences, localSolids } from '../../src/checks/solids'
import { createBuildPlan } from '../../src/drawings/buildPlan'
import { cutList } from '../../src/model/cutlist'
import { deserialize, serialize } from '../../src/model/fileFormat'
import { validate } from '../../src/model/validate'
import { layoutAll } from '../../src/optimize/layout'
import { shoppingList } from '../../src/optimize/shopping'
import { clearShapeCache } from '../../src/ui/three/BoardMesh'
import { edit, fixtureText, openedStore, slowness, time } from './harness'

const k = slowness()
const within = (name: string, ms: number, budget: number) => {
  const allowed = budget * k
  expect(ms, `${name}: ${ms.toFixed(1)} ms against a budget of ${allowed.toFixed(0)} ms`).toBeLessThan(allowed)
}

test('the fixture is the size of project this guard is about', () => {
  const p = deserialize(fixtureText())
  expect(p.boards.length).toBeGreaterThanOrEqual(300)
  expect(p.boards.length).toBeLessThanOrEqual(600)
  expect(p.joints.length).toBeGreaterThan(500)
  expect((p.groups ?? []).filter(g => !g.parentId).length).toBe(16)
})

test('opening, validating, listing, laying out and saving stay quick', () => {
  const text = fixtureText()
  const p = deserialize(text)
  within('deserialize', time(() => deserialize(text), 3), 150)
  within('open (store.openDesignText)', time(() => openedStore(text), 3), 400)
  within('validate', time(() => validate(p), 5), 150)
  within('cut list', time(() => cutList(p), 5), 250)
  within('sheet layouts', time(() => layoutAll(p, []), 3), 400)
  within('shopping list', time(() => shoppingList(p, [], undefined), 3), 400)
  within('serialize (save)', time(() => serialize(p), 5), 100)
})

test('changing one dimension, undo and redo stay quick, and the cut list follows', () => {
  const store = openedStore()
  let n = 0
  within('apply one edit', time(() => store.getState().apply(q => edit(q, n++)), 5), 250)
  within('edit then cut list', time(() => { store.getState().apply(q => edit(q, n++)); cutList(store.getState().project) }, 5), 400)
  within('undo + redo', time(() => { store.getState().undo(); store.getState().redo() }, 5), 300)
  const side = store.getState().project.boards.find(b => b.name === 'Side')!
  const rows = cutList(store.getState().project).rows
  expect(rows.some(r => r.boardIds.includes(side.id) && r.length === side.length)).toBe(true)
})

test('part shapes, interference and door/drawer clearance checks stay quick, and repeat checks are cheaper', () => {
  const p = deserialize(fixtureText())
  const cold = (fn: () => unknown) => time(() => { clearShapeCache(); clearSharedVolumes(); fn() }, 1, false)
  within('part shapes, cold', cold(() => localSolids(p)), 12_000)
  within('interference check, cold', cold(() => interferences(p)), 15_000)
  within('clearance check, cold', cold(() => clearance(p)), 15_000)
  within('part shapes, again', time(() => localSolids(p), 3), 400)
  within('interference check, again', time(() => interferences(p), 3), 600)
  within('clearance check, again', time(() => clearance(p), 3, false), 600)
}, 120_000)

test('a build plan for the whole kitchen is made in a sane time', () => {
  const p = deserialize(fixtureText())
  clearShapeCache()
  const ms = time(() => {
    const r = createBuildPlan(p, { paper: 'letter', scale: 'auto', hidden: true, date: '2026-01-01' })
    expect(r.ok).toBe(true)
  }, 1, false)
  within('create build plan', ms, 90_000)
}, 240_000)
