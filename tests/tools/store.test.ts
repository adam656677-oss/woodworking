import { cleanInventory, journalTotals, lowStock, type JournalEntry } from '../../src/tools/store'
import { shoppingList } from '../../src/optimize/shopping'
import { emptyProject } from '../../src/model/woods'
import { applyTemplate } from '../../src/templates'
import { addDoors, DOOR_DEFAULTS } from '../../src/cabinet/doors'
import { setSchedule, fromTemplate } from '../../src/finish/schedule'

const e = (o: Partial<JournalEntry>): JournalEntry => ({ id: Math.random().toString(), date: '2026-10-31', project: 'Shelf', notes: '', minutes: 0, photos: [], costs: [], ...o })

test('journal totals add the project entries and Shop Mode minutes', () => {
  const t = journalTotals([e({ minutes: 45, costs: [{ what: 'Glue', amount: 6.5 }] }), e({ minutes: 30, costs: [{ what: 'Screws', amount: 3.25 }] }), e({ project: 'Other', minutes: 99 })], 'Shelf', 20)
  expect(t).toEqual({ minutes: 95, cost: 9.75, entries: 2 })
})

test('low stock: at or below the mark', () => {
  const inv = cleanInventory({ hardware: [{ id: 'a', itemId: 'x', name: 'Hinges', qty: 2, min: 2 }, { id: 'b', itemId: 'y', name: 'Pulls', qty: 5, min: 2 }], finishes: [{ id: 'c', product: 'Shellac', amount: 0.5, unit: 'qt', min: 1 }], tools: [] })
  expect(lowStock(inv)).toEqual(['Hinges: 2 left', 'Shellac: 0.5 qt left'])
  expect(cleanInventory({ hardware: [{ id: 1 }], finishes: 'no' })).toEqual({ tools: [], hardware: [], finishes: [] })
})

test('the shopping list buys only the hardware and finishes the shop is short of', () => {
  const { template: _t, ...p0 } = applyTemplate(emptyProject('T'), 'bookshelf', {})
  const d = addDoors(p0, { x: 0.72, y: 0, z: 1, width: 28, height: 20 }, { ...DOOR_DEFAULTS, pair: true })
  if ('error' in d) throw new Error(d.error)
  const p = setSchedule(d.project, fromTemplate('wipe-poly'))
  const full = shoppingList(p)
  const hinge = full.lines.find(l => l.section === 'hardware' && /hinge/i.test(l.what))!
  const hingeId = p.hardware!.find(h => /hinge/.test(h.itemId))!.itemId
  const less = shoppingList(p, [], { hardware: [{ itemId: hingeId, qty: hinge.qty - 2 }], finishes: [{ finishId: 'wipe-poly', amount: 1 }] })
  const h2 = less.lines.find(l => l.section === 'hardware' && /hinge/i.test(l.what))!
  expect(h2.qty).toBe(2)
  expect(h2.what).toMatch(new RegExp(`you have ${hinge.qty - 2}; this project needs ${hinge.qty} — buy 2`))
  expect(less.byKind.hardware).toBeLessThan(full.byKind.hardware)
  expect(full.lines.find(l => l.section === 'finish')!.qty).toBe(1)
  expect(less.lines.find(l => l.section === 'finish')!.qty).toBe(0)
})
