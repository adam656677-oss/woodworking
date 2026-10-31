import { cleanInventory, entryFor, GENERAL, journalTotals, lowStock, tools, type JournalEntry } from '../../src/tools/store'
import { shoppingList } from '../../src/optimize/shopping'
import { emptyProject } from '../../src/model/woods'
import { applyTemplate } from '../../src/templates'
import { addDoors, DOOR_DEFAULTS } from '../../src/cabinet/doors'
import { setSchedule, fromTemplate } from '../../src/finish/schedule'

const e = (o: Partial<JournalEntry>): JournalEntry => ({ id: Math.random().toString(), date: '2026-10-31', project: 'Shelf', notes: '', minutes: 0, photos: [], costs: [], ...o })

test('journal totals add the project entries and Shop Mode minutes', () => {
  const t = journalTotals([e({ minutes: 45, costs: [{ what: 'Glue', amount: 6.5 }] }), e({ minutes: 30, costs: [{ what: 'Screws', amount: 3.25 }] }), e({ project: 'Other', minutes: 99 })], { name: 'Shelf', file: null }, 20)
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
  expect(h2.what).toMatch(new RegExp(`${hinge.qty - 2} from your shop; this project needs ${hinge.qty} — buy 2`))
  expect(less.byKind.hardware).toBeLessThan(full.byKind.hardware)
  expect(full.lines.find(l => l.section === 'finish')!.qty).toBe(1)
  expect(less.lines.find(l => l.section === 'finish')!.qty).toBe(0)
})

describe('the journal and inventory store', () => {
  const setup = (files: Record<string, { data: unknown; damaged: boolean }>) => {
    const saved: Record<string, unknown[]> = {}
    ;(globalThis as any).window = (globalThis as any).window ?? {}
    ;(window as any).aa = {
      loadData: async (n: string) => files[n] ?? { data: null, damaged: false },
      saveData: async (n: string, d: unknown) => { (saved[n] ??= []).push(JSON.parse(JSON.stringify(d))) }
    }
    tools.setState({ loaded: false, journal: [], inventory: { tools: [], hardware: [], finishes: [] }, damaged: [], saveError: null })
    return saved
  }
  test('entries it can\'t read are kept and written back, not dropped', async () => {
    const saved = setup({ journal: { data: [e({ id: 'ok', minutes: 5 }), { id: 'odd', minutes: -3 }], damaged: false } })
    await tools.getState().load()
    expect(tools.getState().journal.map(x => x.id)).toEqual(['ok'])
    tools.getState().addEntry({ date: '2026-10-31', project: 'Shelf', notes: 'x', minutes: 10, photos: [], costs: [] })
    expect((saved.journal.at(-1) as any[]).map(x => x.id)).toContain('odd')
  })
  test('minutes are never negative or fractional', async () => {
    setup({})
    await tools.getState().load()
    const id = tools.getState().addEntry({ date: '2026-10-31', project: 'Shelf', notes: '', minutes: -30, photos: [], costs: [] })
    expect(tools.getState().journal.find(x => x.id === id)!.minutes).toBe(0)
    tools.getState().updateEntry(id, { minutes: 12.6 })
    expect(tools.getState().journal.find(x => x.id === id)!.minutes).toBe(13)
  })
  test('a damaged file is reported', async () => {
    setup({ inventory: { data: { tools: [{ id: 't', name: 'Saw', kind: 'Hand tool' }] }, damaged: true } })
    await tools.getState().load()
    expect(tools.getState().damaged).toEqual(['inventory'])
    expect(tools.getState().inventory.tools).toHaveLength(1)
  })
  test('a failed save is reported', async () => {
    setup({})
    ;(window as any).aa.saveData = async () => { throw new Error('disk full') }
    await tools.getState().load()
    tools.getState().addEntry({ date: '2026-10-31', project: 'Shelf', notes: 'x', minutes: 1, photos: [], costs: [] })
    await new Promise(r => setTimeout(r, 0))
    expect(tools.getState().saveError).toMatch(/journal/i)
  })
  test('inventory saves wait for typing to stop', async () => {
    vi.useFakeTimers()
    const saved = setup({})
    await tools.getState().load()
    for (const q of [1, 12, 123]) tools.getState().setInventory(i => ({ ...i, hardware: [{ id: 'h', itemId: 'x', name: 'Hinge', qty: q }] }))
    expect(saved.inventory).toBeUndefined()
    vi.advanceTimersByTime(600)
    expect(saved.inventory).toHaveLength(1)
    expect((saved.inventory[0] as any).hardware[0].qty).toBe(123)
    vi.useRealTimers()
  })
})

test('entries belong to a project by its file when it has one (renaming keeps them), else by name; General is its own', () => {
  const es = [e({ project: 'Shelf', file: 'C:/a/Shelf.aaw', minutes: 10 }), e({ project: 'Old name', file: 'C:/a/Shelf.aaw', minutes: 5 }), e({ project: 'Shelf', minutes: 1 }), e({ project: GENERAL, minutes: 7 })]
  expect(journalTotals(es, { name: 'New name', file: 'C:/a/Shelf.aaw' }).minutes).toBe(15)
  expect(journalTotals(es, { name: 'Shelf', file: null }).minutes).toBe(1)
  expect(es.filter(x => entryFor(x, { name: GENERAL, file: null }))).toHaveLength(1)
})

test('finishes on the shopping list are never counted as "no price"', () => {
  const { template: _t, ...p0 } = applyTemplate(emptyProject('T'), 'bookshelf', {})
  expect(shoppingList(setSchedule(p0, fromTemplate('wipe-poly'))).missing).toBe(shoppingList(p0).missing)
})

test('dowels for a doweled joint go on the shopping list, without counting as a missing price', async () => {
  const { makeBoard, ORIENT } = await import('../../src/templates/place')
  const { addJoint } = await import('../../src/model/ops')
  const { contactBetween } = await import('../../src/model/contact')
  const p = emptyProject('D')
  const w = p.woods.find(x => x.id === '1x6')!
  const a = makeBoard('A', w, 5.5, 24, ORIENT.flatY, { x: 0, y: 0, z: 0 })
  const b = makeBoard('B', w, 5.5, 24, ORIENT.flatY, { x: 5.5, y: 0, z: 0 })
  const p0 = { ...p, boards: [a, b] }
  const c = contactBetween(p0, a.id, b.id)!
  const r = addJoint(p0, 'joinery', c.host, c.partner, { style: 'dowel', count: 3 })
  if ('error' in r) throw new Error(r.error)
  const list = shoppingList(r.project)
  const line = list.lines.find(l => /dowel/i.test(l.what))!
  expect(line.qty).toBe(3)
  expect(list.missing).toBe(shoppingList(p0).missing)
})
