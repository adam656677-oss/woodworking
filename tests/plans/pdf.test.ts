import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PlanImportError, pdfTextLines } from '../../src/plans/pdf'

const fx = (n: string) => new Uint8Array(readFileSync(join(__dirname, 'fixtures', n)))

// Includes the first dynamic PDF.js import and worker startup; not a performance benchmark.
test('a text PDF gives its lines in reading order, with sizes', async () => {
  const r = await pdfTextLines(fx('stool.pdf'))
  const texts = r.lines.map(l => l.text)
  expect(r.pageCount).toBe(1)
  expect(r.scanPages).toEqual([])
  expect(texts[0]).toBe('Simple Step Stool')
  expect(texts).toContain('2 - 3/4 x 11-1/4 x 9" Sides')
  expect(texts).toContain('1. Cut all parts to length.')
  const title = r.lines[0]
  expect(title.size!).toBeGreaterThan(r.lines.find(l => l.text.startsWith('1.'))!.size!)
}, 15_000)

test('a page that is only a picture is reported as a scan', async () => {
  const r = await pdfTextLines(fx('scan.pdf'))
  expect(r.scanPages).toEqual([1])
})

test('something that is not a PDF is reported as damaged', async () => {
  await expect(pdfTextLines(new Uint8Array([1, 2, 3, 4]))).rejects.toMatchObject({ name: 'PlanImportError', kind: 'damaged' })
  expect(new PlanImportError('locked').message).toMatch(/locked/)
})
