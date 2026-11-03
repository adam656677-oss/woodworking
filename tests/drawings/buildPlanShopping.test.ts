import { beforeAll, expect, test } from 'vitest'
import { emptyProject } from '../../src/model/woods'
import { applyTemplate } from '../../src/templates'
import { createBuildPlan, isBuildPlanCurrent } from '../../src/drawings/buildPlan'
import { createShoppingSnapshot, type ShoppingInputs } from '../../src/drawings/shoppingSnapshot'

const project = applyTemplate(emptyProject('Shopping plan'), 'box', {})
const inputs: ShoppingInputs = { stock: [], inventory: { hardware: [{ itemId: 'test-item', qty: 4 }], finishes: [] } }
const before = JSON.stringify({ project, inputs })
let result: ReturnType<typeof createBuildPlan>
beforeAll(() => {
  result = createBuildPlan(project, { paper: 'letter', scale: 'auto', hidden: true, date: '2026-11-03' }, inputs)
}, 60_000)

test('captures shopping and warnings without mutating source inputs', () => {
  if (!result.ok) throw new Error(result.issues.join('; '))
  expect(result.plan.shoppingSnapshot).toEqual(createShoppingSnapshot(project, inputs))
  expect(result.plan.reviewNotes).toEqual(expect.arrayContaining(result.plan.shoppingSnapshot.warnings))
  expect(JSON.stringify({ project, inputs })).toBe(before)
})

test('invalidates on hardware, finish, stock, and inventory availability changes', () => {
  if (!result.ok) throw new Error(result.issues.join('; '))
  const captured = JSON.stringify(result.plan.shoppingSnapshot)
  expect(isBuildPlanCurrent(result.plan, project, inputs)).toBe(true)
  const hardware = JSON.parse(JSON.stringify(inputs)) as ShoppingInputs
  hardware.inventory.hardware[0].qty = 2
  expect(isBuildPlanCurrent(result.plan, project, hardware)).toBe(false)
  const finishes = JSON.parse(JSON.stringify(inputs)) as ShoppingInputs
  finishes.inventory.finishes.push({ finishId: 'test-finish', amount: 1 })
  expect(isBuildPlanCurrent(result.plan, project, finishes)).toBe(false)
  const stock = JSON.parse(JSON.stringify(inputs)) as ShoppingInputs
  stock.stock.push({} as ShoppingInputs['stock'][number])
  expect(isBuildPlanCurrent(result.plan, project, stock)).toBe(false)
  expect(isBuildPlanCurrent(result.plan, project)).toBe(false)
  expect(JSON.stringify(result.plan.shoppingSnapshot)).toBe(captured)
})

test('legacy plans without a shopping capture require regeneration', () => {
  expect(isBuildPlanCurrent({ sourceSnapshot: JSON.stringify(project) }, project)).toBe(false)
})

test('omitted inventory remains distinct from loaded empty inventory', () => {
  const snapshot = createShoppingSnapshot(project)
  const plan = { sourceSnapshot: JSON.stringify(project), shoppingSnapshot: snapshot }
  expect(snapshot.inventoryIncluded).toBe(false)
  expect(snapshot.warnings.join(' ')).toContain('Generated without shop inventory')
  expect(isBuildPlanCurrent(plan, project)).toBe(true)
  expect(isBuildPlanCurrent(plan, project, { stock: [], inventory: { hardware: [], finishes: [] } })).toBe(false)
})
