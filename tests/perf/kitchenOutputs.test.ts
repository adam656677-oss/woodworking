// The kitchen fixture's outputs (cut list, shopping, layouts, warnings, checks, build plan) were recorded before any
// performance work. Speeding the app up must not change any of them: if one of these fails, behaviour changed.
// To re-record on purpose: AA_WRITE_FIXTURE=1 npx vitest run tests/perf/kitchenOutputs.test.ts
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { clearance } from '../../src/cabinet/motion'
import { interferences } from '../../src/checks/solids'
import { createBuildPlan } from '../../src/drawings/buildPlan'
import { cutList, cutListCsv } from '../../src/model/cutlist'
import { deserialize } from '../../src/model/fileFormat'
import { updateBoard } from '../../src/model/ops'
import { validate } from '../../src/model/validate'
import { layoutAll } from '../../src/optimize/layout'
import { shoppingList } from '../../src/optimize/shopping'
import { fixtureText } from './harness'

const EXPECTED = resolve(__dirname, '../fixtures/kitchen.expected.json')
const sha = (s: string) => createHash('sha1').update(s).digest('hex')
const round = (n: number) => Math.round(n * 1e6) / 1e6

/** Replaces random ids so two runs compare equal. */
const strip = (v: unknown): unknown => JSON.parse(JSON.stringify(v, (k, x) => (typeof x === 'string' && /^[srpkf]_[a-z0-9]{6,}_\d+$/.test(x) ? '<id>' : x)))

function outputs(heavy: boolean) {
  const p = deserialize(fixtureText())
  const cl = cutList(p)
  // A copy with three parts pushed into their neighbours, so the overlap and no-longer-lines-up warnings fire too.
  const moved = ['Side', 'Shelf', 'Top rail'].reduce((q, name) => {
    const b = q.boards.find(x => x.name === name)!
    return updateBoard(q, b.id, { position: { ...b.position, x: b.position.x + 0.5, z: b.position.z + 0.25 } })
  }, p)
  const out: Record<string, unknown> = {
    cutList: strip(cl),
    cutListCsv: cutListCsv(p),
    shopping: shoppingList(p, [], undefined),
    layouts: strip(layoutAll(p, [])),
    warnings: strip(validate(p)),
    warningsMoved: strip(validate(moved))
  }
  if (heavy) {
    out.interferences = strip(interferences(p).map(i => ({ ...i, volume: round(i.volume) })))
    out.clearance = strip(clearance(p))
    out.interferencesMoved = strip(interferences(moved).map(i => ({ ...i, volume: round(i.volume) })))
    out.clearanceMoved = strip(clearance(moved))
    const plan = createBuildPlan(p, { paper: 'letter', scale: 'auto', hidden: true, date: '2026-01-01' })
    if (!plan.ok) throw new Error(plan.issues.join(' '))
    out.plan = strip({
      sheets: plan.plan.sheets.map(s => ({ title: s.title, paper: s.paper, svg: sha(s.svg) })),
      parts: plan.plan.parts, cutList: plan.plan.cutList, steps: plan.plan.steps, shopping: plan.plan.shoppingSnapshot, notes: plan.plan.reviewNotes
    })
  }
  return out
}

test('the kitchen cut list, shopping list, layouts and warnings are what they were before the performance work', () => {
  const got = outputs(false)
  if (process.env.AA_WRITE_FIXTURE) {
    writeFileSync(EXPECTED, JSON.stringify({ ...got, ...outputs(true) }, null, 1))
    return
  }
  expect(existsSync(EXPECTED)).toBe(true)
  const want = JSON.parse(readFileSync(EXPECTED, 'utf8'))
  for (const k of Object.keys(got)) expect(JSON.parse(JSON.stringify(got[k])), k).toEqual(want[k])
  // A sanity floor so an empty fixture can't pass: the real kitchen has this many cut-list lines and no warnings.
  expect(want.cutList.rows.length).toBeGreaterThan(60)
  expect(want.warnings).toEqual([])
  expect(want.warningsMoved.length).toBeGreaterThan(0)
  expect(want.interferencesMoved.length).toBeGreaterThan(0)
}, 180_000)

test('the kitchen solid checks and build plan are what they were before the performance work', () => {
  if (process.env.AA_WRITE_FIXTURE) return
  const got = outputs(true)
  const want = JSON.parse(readFileSync(EXPECTED, 'utf8'))
  for (const k of ['interferences', 'clearance', 'interferencesMoved', 'clearanceMoved', 'plan']) expect(JSON.parse(JSON.stringify(got[k])), k).toEqual(want[k])
}, 180_000)
