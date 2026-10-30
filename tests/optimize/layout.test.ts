import { emptyProject } from '../../src/model/woods'
import { applyTemplate } from '../../src/templates'
import { layoutAll, packLumber, packSheets, roughThickness, shopStockFor } from '../../src/optimize/layout'
import type { Piece } from '../../src/optimize/pieces'

const piece = (no: number, w: number, l: number, grain = true): Piece => ({ boardId: `b${no}`, no, name: `Part ${no}`, woodId: 'ply', thickness: 0.75, w, l, grain })
const sheet = { label: 'Sheet', w: 48, l: 96, edgeTrim: 0.25, endTrim: 0.25 }

test('parts the same width share a strip (one fence setting); kerf is between parts', () => {
  const r = packSheets([piece(1, 10, 30), piece(2, 10, 30), piece(3, 10, 30)], sheet, 0.125)
  expect(r.sheets).toHaveLength(1)
  const st = r.sheets[0].strips
  expect(st).toHaveLength(1)
  expect(st[0].parts.map(q => q.y)).toEqual([0, 30.125, 60.25])
  expect(r.sheets[0].cuts[0]).toBe('Rip a strip 10" wide')
  expect(r.ripWidths).toBe(1)
})

test('known small cases: four 24 × 48 quarters fill exactly 1 sheet with no trim or kerf; with them, each needs its own', () => {
  const quarters = [1, 2, 3, 4].map(i => piece(i, 24, 48))
  expect(packSheets(quarters, { ...sheet, edgeTrim: 0, endTrim: 0 }, 0).sheets).toHaveLength(1)
  expect(packSheets(quarters, sheet, 0.125).sheets).toHaveLength(4)
  // Eight 23-3/4 × 23-3/4 parts with a 1/8" kerf: two per strip width, four along — one sheet.
  expect(packSheets([1, 2, 3, 4, 5, 6, 7, 8].map(i => piece(i, 23.75, 23.75)), { ...sheet, edgeTrim: 0, endTrim: 0 }, 0.125).sheets).toHaveLength(1)
})

test('grain lock keeps a long part along the sheet; a grain-free part may turn to fit', () => {
  // 60" across a 48" sheet only fits turned.
  const locked = packSheets([piece(1, 60, 20)], sheet, 0.125)
  expect(locked.tooBig.map(p => p.no)).toEqual([1])
  const free = packSheets([piece(1, 60, 20, false)], sheet, 0.125)
  expect(free.tooBig).toEqual([])
  expect(free.sheets[0].strips[0].parts[0].l).toBe(60)
})

test('lumber: full-width parts are crosscut, narrow ones ripped; buys the shortest lengths that fit', () => {
  const wood = emptyProject('T').woods.find(w => w.id === '1x4')!
  const parts: Piece[] = [piece(1, 3.5, 40), piece(2, 3.5, 40), piece(3, 1.5, 30), piece(4, 1.5, 30)].map(p => ({ ...p, woodId: '1x4' }))
  const r = packLumber(parts, wood, 0.125, 0.5)
  // 40 + 40 + kerf + 1" trims = 81.125 → an 8' board; both 30" pieces come from one 1-1/2" strip of another 8'.
  expect(r.boards.map(b => b.length)).toEqual([96, 96])
  expect(r.boards[1].cuts[0]).toBe('Rip 1 strip 1-1/2" wide')
  expect(packLumber([{ ...piece(5, 3.5, 150), woodId: '1x4' }], wood, 0.125, 0.5).tooBig).toHaveLength(1)
})

test('shop stock first; a board with a knot is used around it', () => {
  const stock = shopStockFor([{ id: 's1', woodId: 'ply', kind: 'offcut', width: 24, length: 40 }, { id: 'b1', woodId: 'ply', kind: 'board', width: 6, length: 96, defects: [{ from: 40, to: 44 }] }], { id: 'ply' } as never, 0.25, 0.25)
  expect(stock.map(s => s.l)).toEqual([40, 40, 52])
  const r = packSheets([piece(1, 20, 35)], sheet, 0.125, stock)
  expect(r.sheets[0].stock.fromShop).toBe('s1')
})

test('the bookshelf: one sheet of 3/4 ply, one of 1/4 ply; rough thickness for hardwood', () => {
  const p = applyTemplate(emptyProject('T'), 'bookshelf', {})
  const l = layoutAll(p)
  expect(l.map(x => [x.wood.id, x.kind === 'lumber' ? x.result.boards.length : x.result.sheets.length])).toEqual([['ply-1-4', 1], ['ply-3-4', 1]])
  expect([0.75, 1, 1.75].map(roughThickness)).toEqual([1, 1.25, 2])
})
