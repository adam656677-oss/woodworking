import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ocrImage, stopOcr } from '../../electron/ocr'
import { draftPlan } from '../../src/plans/draft'

afterAll(() => stopOcr())

test('a tilted, low-contrast phone photo of a plan page drafts its steps and most of its cut list', async () => {
  const bytes = new Uint8Array(readFileSync(join(__dirname, '../plans/fixtures/photo-page.jpg')))
  const lines = await ocrImage(bytes, 1)
  expect(lines.every(l => l.page === 1 && l.box.length === 4)).toBe(true)
  const d = draftPlan(lines, { drill: 'drill' })
  expect(d.plan.name).toBe('Simple Step Stool')
  expect(d.plan.steps).toHaveLength(5)
  const parts = d.plan.cutRows.map(r => r.part)
  const expected = ['Sides', 'Top', 'Stretcher', 'Aprons', 'Step']
  expect(expected.filter(p => parts.includes(p)).length).toBeGreaterThanOrEqual(4)
  const sides = d.plan.cutRows.find(r => r.part === 'Sides')
  if (sides) expect([sides.qty, sides.thickness, sides.width, sides.length]).toEqual([2, 0.75, 11.25, 9])
}, 60_000)

test('the same photo after the app\'s clean-up (grey, contrast stretched) still drafts at least 4 of its 5 cut rows', async () => {
  const bytes = new Uint8Array(readFileSync(join(__dirname, '../plans/fixtures/photo-page-prepared.png')))
  const d = draftPlan(await ocrImage(bytes, 1), { drill: 'drill' })
  const parts = d.plan.cutRows.map(r => r.part)
  expect(['Sides', 'Top', 'Stretcher', 'Aprons', 'Step'].filter(p => parts.includes(p)).length).toBeGreaterThanOrEqual(4)
  expect(d.plan.steps).toHaveLength(5)
}, 60_000)
