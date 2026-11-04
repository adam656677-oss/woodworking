import { expect, test } from 'vitest'
import { emptyProject } from '../../src/model/woods'
import { shoppingList } from '../../src/optimize/shopping'
import { createShoppingSnapshot, isShoppingSnapshotCurrent, type ShoppingInputs } from '../../src/drawings/shoppingSnapshot'

const inputs = (): ShoppingInputs => ({ stock: [], inventory: { hardware: [{ itemId: 'test-item', qty: 4 }], finishes: [] } })

test('uses the existing generator without mutating the project or shop inputs', () => {
  const project = emptyProject('Shopping snapshot')
  const shop = inputs()
  const before = JSON.stringify({ project, shop })
  const snapshot = createShoppingSnapshot(project, shop)
  expect(snapshot.shopping).toEqual(shoppingList(project, shop.stock, shop.inventory))
  expect(snapshot.inventoryIncluded).toBe(true)
  expect(JSON.stringify({ project, shop })).toBe(before)
})

test('detects inventory changes and retains the captured inputs', () => {
  const shop = inputs()
  const snapshot = createShoppingSnapshot(emptyProject('Shopping snapshot'), shop)
  const captured = snapshot.inputsSnapshot
  expect(isShoppingSnapshotCurrent(snapshot, shop)).toBe(true)
  shop.inventory.hardware[0].qty = 2
  expect(isShoppingSnapshotCurrent(snapshot, shop)).toBe(false)
  expect(snapshot.inputsSnapshot).toBe(captured)
  expect(JSON.parse(snapshot.inputsSnapshot!).inventory.hardware[0].qty).toBe(4)
})

test('detects finish inventory changes', () => {
  const shop = inputs()
  const snapshot = createShoppingSnapshot(emptyProject('Shopping snapshot'), shop)
  shop.inventory.finishes.push({ finishId: 'test-finish', amount: 1 })
  expect(isShoppingSnapshotCurrent(snapshot, shop)).toBe(false)
})

test('explicitly distinguishes absent inventory from loaded empty inventory', () => {
  const project = emptyProject('Shopping snapshot')
  const snapshot = createShoppingSnapshot(project)
  expect(snapshot.inventoryIncluded).toBe(false)
  expect(snapshot.warnings.join(' ')).toContain('Generated without shop inventory')
  expect(isShoppingSnapshotCurrent(snapshot)).toBe(true)
  expect(isShoppingSnapshotCurrent(snapshot, { stock: [], inventory: { hardware: [], finishes: [] } })).toBe(false)
})
