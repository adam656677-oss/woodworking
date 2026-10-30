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
  expect(fitScale(500, 500, 9, 6)).toBe(16)
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
  chain(0, [0.75, 9.2187, 17.6562], 1, (_a, _b, t) => { labels.push(t); return '' })
  expect(labels).toEqual(['3/4"', '8-15/32"', '8-7/16"'])
  const even: string[] = []
  chain(0, [1, 3, 5, 7], 1, (_a, _b, t) => { even.push(t); return '' })
  expect(even).toEqual(['1"', '3 × 2" = 6" (eq. sp.)'])
})
