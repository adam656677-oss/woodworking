import type { Project } from '../model/types'
import { shoppingList } from '../optimize/shopping'

export type ShoppingInputs = {
  stock: NonNullable<Parameters<typeof shoppingList>[1]>
  inventory: NonNullable<Parameters<typeof shoppingList>[2]>
}

/** Omitted inputs explicitly mean no shop-inventory deductions. */
export function createShoppingSnapshot(project: Project, inputs?: ShoppingInputs) {
  const inputsSnapshot = inputs === undefined ? null : JSON.stringify(inputs)
  const captured = inputsSnapshot === null ? undefined : JSON.parse(inputsSnapshot) as ShoppingInputs
  const model = JSON.parse(JSON.stringify(project)) as Project
  const shopping = shoppingList(model, captured?.stock ?? [], captured?.inventory)
  const warnings = ['Estimated priced total excludes items without prices. Review quantities before purchasing.']
  if (!captured) warnings.push('Generated without shop inventory; no shop-stock or inventory deductions were applied.')
  if (shopping.missing) warnings.push(`${shopping.missing} purchase rows are missing prices.`)
  if (shopping.lines.some(line => line.unpriced)) warnings.push('Joint supplies are not priced or deducted from hardware inventory.')
  if (shopping.lines.some(line => line.section === 'finish')) warnings.push('Finish quantities and costs require review; inventory on hand does not guarantee sufficient coverage.')
  return { inputsSnapshot, inventoryIncluded: captured !== undefined, shopping, warnings }
}

/** Project freshness is checked separately by isBuildPlanCurrent. */
export function isShoppingSnapshotCurrent(snapshot: { inputsSnapshot: string | null }, inputs?: ShoppingInputs): boolean {
  return snapshot.inputsSnapshot === (inputs === undefined ? null : JSON.stringify(inputs))
}
