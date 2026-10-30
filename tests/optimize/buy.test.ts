import jsQR from 'jsqr'
import { emptyProject } from '../../src/model/woods'
import { applyTemplate } from '../../src/templates'
import { addDoors, DOOR_DEFAULTS } from '../../src/cabinet/doors'
import { shoppingList } from '../../src/optimize/shopping'
import { labelPositions, labelsFor, LABEL_SHEETS, qrModules } from '../../src/optimize/labels'
import { bandingNote, cutSize, setBanding } from '../../src/optimize/banding'
import { cutList } from '../../src/model/cutlist'
import type { Project } from '../../src/model/types'

const priced = (p: Project): Project => ({ ...p, woods: p.woods.map(w => (w.id === 'ply-3-4' ? { ...w, pricePerSheet: 60 } : w.id === 'ply-1-4' ? { ...w, pricePerSheet: 30 } : w.id === 'hw-4-4' ? { ...w, pricePerBoardFoot: 8 } : w)) })

test('the shopping list: sheets, hardwood by the board foot with waste, hardware, tax', () => {
  let p = priced(applyTemplate(emptyProject('T'), 'bookshelf', {}))
  const { template: _t, ...free } = p
  p = free
  const d = addDoors(p, { x: 0.72, y: 0, z: 1, width: 28, height: 20 }, { ...DOOR_DEFAULTS, pair: true })
  if ('error' in d) throw new Error(d.error)
  p = { ...d.project, cutSettings: { tax: 8 } }
  const s = shoppingList(p)
  expect(s.lines.filter(l => l.section === 'wood').map(l => [l.what.split(' (')[0].split(' —')[0], l.unit])).toEqual(expect.arrayContaining([['3/4" Plywood', 'sheet'], ['1/4" Plywood', 'sheet'], ['Hardwood 4/4', 'bd ft']]))
  const hw = s.lines.find(l => l.unit === 'bd ft')!
  expect(hw.what).toContain('4/4 rough (incl. 20% waste)')
  expect(s.byKind.wood).toBe(s.lines.filter(l => l.section === 'wood').reduce((n, l) => n + (l.total ?? 0), 0))
  expect(s.tax).toBeCloseTo(s.subtotal * 0.08, 2)
  expect(s.total).toBeCloseTo(s.subtotal + s.tax, 2)
  expect(s.missing).toBe(0)
})

test('edge banding: notes, cut size for thick banding, linear feet', () => {
  const p0 = applyTemplate(emptyProject('T'), 'bookshelf', {})
  const { template: _t, ...p1 } = p0
  const shelf = p1.boards.find(b => b.name === 'Shelf')!
  let p = setBanding(p1, [shelf.id], { edges: ['left'], bandId: 'band-birch' })
  expect(bandingNote(p.boards.find(b => b.id === shelf.id)!)).toBe('Band left edge (Birch veneer banding 3/4")')
  expect(cutSize(p.boards.find(b => b.id === shelf.id)!)).toEqual({ width: shelf.width, length: shelf.length })
  p = setBanding(p1, [shelf.id], { edges: ['left', 'right'], bandId: 'band-wood' })
  const row = cutList(p).rows.find(r => r.boardIds.includes(shelf.id))!
  expect([row.cutWidth, row.notes[0]]).toEqual([shelf.width - 1 / 16, 'Band both long edges (Solid wood banding 1/32")'])
  const s = shoppingList(p)
  expect(s.lines.find(l => l.section === 'banding')).toMatchObject({ qty: Math.ceil(2 * shelf.length / 12 * 1.1), unit: 'ft' })
})

test('labels: one per part with its number; the QR code scans back', () => {
  const p = applyTemplate(emptyProject('Bookshelf'), 'bookshelf', {})
  const labels = labelsFor(p)
  expect(labels).toHaveLength(p.boards.length)
  const shelf = labels.find(l => l.name === 'Shelf')!
  expect(shelf.qr).toMatch(/^AAWS\|Bookshelf\|P\d+\|Shelf\|29-1\/16 x 9-25\/32 x 23\/32$/)
  // Draw the code (4 px a module, quiet zone) and read it back.
  const { size, dark } = qrModules(shelf.qr)
  const px = 4, n = (size + 8) * px
  const img = new Uint8ClampedArray(n * n * 4).fill(255)
  for (const [x, y] of dark) for (let dy = 0; dy < px; dy++) for (let dx = 0; dx < px; dx++) { const i = (((y + 4) * px + dy) * n + (x + 4) * px + dx) * 4; img[i] = img[i + 1] = img[i + 2] = 0 }
  expect(jsQR(img, n, n)?.data).toBe(shelf.qr)
})

test('Avery 5160: 30 to a page, 3 across; 5163: 10, 2 across', () => {
  const pos = labelPositions(31, LABEL_SHEETS['5160'])
  expect(pos[0]).toEqual({ page: 0, x: 0.1875, y: 0.5 })
  expect(pos[2]).toEqual({ page: 0, x: 0.1875 + 2 * 2.75, y: 0.5 })
  expect(pos[29]).toEqual({ page: 0, x: 0.1875 + 2 * 2.75, y: 9.5 })
  expect(pos[30].page).toBe(1)
  expect(labelPositions(11, LABEL_SHEETS['5163'])[10].page).toBe(1)
})
