import { writeFileSync, mkdirSync } from 'node:fs'
import { emptyProject } from '../../src/model/woods'
import { applyTemplate } from '../../src/templates'
import { drawingSheets, partList } from '../../src/drawings/views'
import { fitScale } from '../../src/drawings/sheet'

const OUT = process.env.AA_SVG
const bookshelf = () => { const { template: _t, ...p } = applyTemplate(emptyProject('Bookshelf'), 'bookshelf', {}); return p }

test('scale: the largest that fits', () => {
  expect(fitScale(30, 20, 9, 6)).toBe(4)
  expect(fitScale(8, 5, 9, 6)).toBe(1)
  expect(fitScale(500, 500, 9, 6)).toBe(48)
  expect(fitScale(168, 40, 8.4, 5)).toBe(24)
})

test('a bookshelf makes views, exploded, section and part sheets, numbered n of N', () => {
  const p = bookshelf()
  const sheets = drawingSheets(p, { views: true, exploded: true, section: true, parts: 'all' }, { paper: 'letter', scale: 'auto', hidden: true, date: '2026-10-30' })
  expect(sheets.length).toBe(3 + partList(p).length)
  sheets.forEach((s, i) => expect(s.svg).toContain(`${i + 1} of ${sheets.length}`))
  expect(sheets[0].svg).toContain('FRONT')
  expect(sheets[0].svg).toContain('36"')
  if (OUT) { mkdirSync(OUT, { recursive: true }); sheets.forEach((s, i) => writeFileSync(`${OUT}/sheet-${i + 1}.svg`, s.svg)) }
}, 60000)

test('a chain of sizes adds up to the rounded positions', async () => {
  const { chain } = await import('../../src/drawings/sheet')
  const labels: string[] = []
  chain(0, [0.75, 9.2187, 20.5], 1, (_a, _b, t) => { labels.push(t); return '' })
  expect(labels).toEqual(['3/4"', '8-15/32"', '11-9/32"'])
  const even: string[] = []
  chain(0, [1, 3, 5, 7], 1, (_a, _b, t) => { even.push(t); return '' })
  expect(even).toEqual(['1"', '3 × 2" = 6" (eq. sp.)'])
})

test('a side with shelf-pin holes: its part sheet spaces them "eq. sp." and notes the drill', async () => {
  const { addShelfPins, PIN_DEFAULTS } = await import('../../src/cabinet/shelfPins')
  const { makeBoard, ORIENT } = await import('../../src/templates/place')
  const p0 = emptyProject('Case')
  const ply = p0.woods.find(w => w.id === 'ply-3-4')!
  const side = makeBoard('Side', ply, 12, 30, ORIENT.uprightY, { x: 0, y: 0, z: 0 })
  const r = addShelfPins({ ...p0, boards: [side] }, side.id, { ...PIN_DEFAULTS, face: 'top' })
  if ('error' in r) throw new Error(r.error)
  const [sheet] = drawingSheets(r, { parts: 'all' }, { paper: 'letter', scale: 'auto', hidden: true, date: 'd' })
  expect(sheet.svg).toContain('14 × 32 mm')
  expect(sheet.svg).toContain('(eq. sp.)')
  expect(sheet.svg).toContain('5 mm holes')
  if (OUT) writeFileSync(`${OUT}/pins.svg`, sheet.svg)
}, 60000)

test('a section shades the faces it cuts through', async () => {
  const { viewLines, VIEWS } = await import('../../src/drawings/lines')
  const p = bookshelf()
  const xs = p.boards.flatMap(b => [b.position.x])
  const l = viewLines(p, VIEWS.side, { clip: { axis: 'x', at: 15, keep: 'low' } })
  expect(l.cut!.length).toBeGreaterThan(4)
  expect(xs.length).toBeGreaterThan(0)
}, 60000)

test('eq. sp. labels: ≈ when the spacing as written does not multiply out; 32 mm system in mm', async () => {
  const { spacingLabel, spacingText } = await import('../../src/drawings/sheet')
  expect(spacingLabel(4, 33.78125)).toBe('4 × 8-29/64" ≈ 33-25/32" (eq. sp.)')
  expect(spacingLabel(3, 6)).toBe('3 × 2" = 6" (eq. sp.)')
  expect(spacingText(96 / 25.4)).toBe('96 mm')
  expect(spacingText(192 / 25.4)).toBe('192 mm')
})

test('the bookshelf side sheet says one of the two is a mirror image', () => {
  const p = bookshelf()
  const side = partList(p).find(q => q.name === 'Side')!
  const [s] = drawingSheets(p, { parts: [side.boardId] }, { paper: 'letter', scale: 'auto', hidden: true, date: 'd' })
  expect(s.svg).toContain('Make 1 as drawn and 1 as a mirror image')
}, 60000)

test('a design too big for the paper at the chosen scale says so', () => {
  const p = bookshelf()
  const [s] = drawingSheets(p, { views: true }, { paper: 'letter', scale: 1, hidden: true, date: 'd' })
  expect(s.svg).toContain('Too big for this paper')
}, 60000)
