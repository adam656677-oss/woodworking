// Piece 4 final-review fixes.
import { emptyProject } from '../../src/model/woods'
import { makeBoard, ORIENT } from '../../src/templates/place'
import { layoutAll, stockAfterUse, shopStockFor } from '../../src/optimize/layout'
import { shoppingList } from '../../src/optimize/shopping'
import { setBanding } from '../../src/optimize/banding'
import { mirrorBoards } from '../../src/model/ops'
import { deserialize, serialize } from '../../src/model/fileFormat'
import type { Project } from '../../src/model/types'

test('using one clear stretch of a knotty board keeps the other stretch and its offcut', () => {
  const items = [{ id: 'b1', woodId: 'hw', kind: 'board' as const, width: 6, length: 96, defects: [{ from: 40, to: 44 }] }]
  const stock = shopStockFor(items, { id: 'hw' } as never, 0.25, 0.25)
  const left = stockAfterUse(items, [{ stockId: stock[0].id, left: { width: 6, length: 8 } }])
  expect(left.map(i => [i.kind, i.width, i.length]).sort()).toEqual([['board', 6, 52], ['offcut', 6, 8]])
})

test('using both stretches keeps an offcut from each', () => {
  const items = [{ id: 'b1', woodId: 'hw', kind: 'board' as const, width: 6, length: 96, defects: [{ from: 40, to: 44 }] }]
  const stock = shopStockFor(items, { id: 'hw' } as never, 0.25, 0.25)
  const left = stockAfterUse(items, [{ stockId: stock[0].id, left: { width: 6, length: 5 } }, { stockId: stock[1].id, left: { width: 3, length: 20 } }])
  expect(left.map(i => [i.width, i.length]).sort()).toEqual([[3, 20], [6, 5]])
  expect(left.every(i => i.kind === 'offcut')).toBe(true)
})

test('mirroring swaps the banded edges', () => {
  const p0 = emptyProject('T')
  const ply = p0.woods.find(w => w.id === 'ply-3-4')!
  const b = makeBoard('Side', ply, 12, 30, ORIENT.uprightY, { x: 0, y: 0, z: 0 })
  let p: Project = { ...p0, boards: [b] }
  p = setBanding(p, [b.id], { bandId: 'band-birch', edges: ['left'] })
  const ax = mirrorBoards(p, [b.id], 'y').boards[0]
  expect(ax.banding?.edges).toEqual(['right'])
})

test('damaged cut settings in a file are dropped field by field', () => {
  const p = { ...emptyProject('T'), cutSettings: { hardwoodWaste: '0.2', tax: 'x', useStock: 'yes', hardwoodBoard: { width: 1, length: 96 } } } as unknown as Project
  const q = deserialize(serialize(p))
  expect(q.cutSettings ?? {}).toEqual({})
  const ok = deserialize(serialize({ ...emptyProject('T'), cutSettings: { hardwoodWaste: 0.3, tax: 7, useStock: true, hardwoodBoard: { width: 8, length: 120 } } } as Project))
  expect(ok.cutSettings).toMatchObject({ hardwoodWaste: 0.3, tax: 7, useStock: true, hardwoodBoard: { width: 8, length: 120 } })
})

test('a hardwood board too narrow to rip a strip sends the part to too big instead of losing it', () => {
  const p0 = emptyProject('T')
  const hw = p0.woods.find(w => w.kind === 'hardwood')!
  const b = makeBoard('Top', hw, 12, 30, ORIENT.flatY, { x: 0, y: 0, z: 0 })
  const l = layoutAll({ ...p0, boards: [b], cutSettings: { hardwoodBoard: { width: 0.6, length: 96 } } } as Project)[0]
  if (l.kind === 'lumber') throw new Error('expected hardwood')
  expect(l.result.tooBig.map(q => q.name)).toEqual(['Top'])
})

test('lumber priced by the board foot uses nominal sizes (1x4 = 1 × 4)', () => {
  const p0 = emptyProject('T')
  const lum = p0.woods.find(w => w.kind === 'lumber' && Math.abs(w.width - 3.5) < 1e-6 && w.thickness < 1)!
  const b = makeBoard('Rail', lum, lum.width, 90, ORIENT.flatY, { x: 0, y: 0, z: 0 })
  const p = { ...p0, woods: p0.woods.map(w => (w.id === lum.id ? { ...w, pricePerBoardFoot: 3 } : w)), boards: [b] }
  const line = shoppingList(p).lines.find(l => l.section === 'wood')!
  const L = 12 * parseFloat(line.what.match(/× ([\d.]+)'/)![1])
  expect(line.each).toBeCloseTo(Math.round(1 * 4 * L / 144 * 3 * 100) / 100, 2)
})

test('rough lumber is bought 4/4 at the thinnest', async () => {
  const { roughThickness } = await import('../../src/optimize/layout')
  expect(roughThickness(0.5)).toBe(1)
  expect(roughThickness(0.75)).toBe(1)
  expect(roughThickness(1)).toBe(1.25)
})

test('changing a banded part to solid wood takes the banding off', async () => {
  const { changeWood } = await import('../../src/model/ops')
  const p0 = emptyProject('T')
  const ply = p0.woods.find(w => w.id === 'ply-3-4')!
  const hw = p0.woods.find(w => w.kind === 'hardwood')!
  const b = makeBoard('Side', ply, 12, 30, ORIENT.uprightY, { x: 0, y: 0, z: 0 })
  const p = setBanding({ ...p0, boards: [b] }, [b.id], { bandId: 'band-birch', edges: ['left'] })
  expect(changeWood(p, b.id, hw.id).boards[0].banding).toBeUndefined()
})
