import { draftPlan } from '../../src/plans/draft'
import { STOOL, TABLE, UNCERTAIN } from './fixtures/lines'

const TOOLS = { drill: 'drill', 'cordless drill': 'drill', jigsaw: 'jigsaw', 'jig saw': 'jigsaw', 'tape measure': 'tape-measure' }
const rowsOf = (d: ReturnType<typeof draftPlan>) => d.plan.cutRows.map(r => [r.qty, r.part, r.thickness, r.width, r.length, r.wood])

test('the name is the biggest text on page 1', () => {
  expect(draftPlan(STOOL, TOOLS).plan.name).toBe('Simple Step Stool')
})

test('every cut-list form drafts the right rows', () => {
  expect(rowsOf(draftPlan(STOOL, TOOLS))).toEqual([
    [2, 'Sides', 0.75, 11.25, 9, ''],
    [2, 'Aprons', 0.75, 3.5, 14.5, '1x4'],
    [1, 'Top', 0.75, 11.25, 16, ''],
    [1, 'Stretcher', 0.75, 3.5, 14.5, ''],
    [2, 'Steps', 0.75, 5.5, 14.5, '1x6'],
    [2, 'Legs', 0.75, 11.25, 9, ''],
    [1, 'Shelf', 17.71875, 0.75, 5.5, '']
  ])
})

test('an OCR-eaten quantity dash is read as quantity and flagged', () => {
  const d = draftPlan(STOOL, TOOLS)
  const legs = d.plan.cutRows.find(r => r.part === 'Legs')!
  expect(d.flags[legs.id]).toMatch(/1-3\/4|check/i)
})

test('metric is converted and flagged', () => {
  const d = draftPlan(STOOL, TOOLS)
  const shelf = d.plan.cutRows.find(r => r.part === 'Shelf')!
  expect(d.flags[shelf.id]).toBe('check me — converted from metric')
})

test('steps come from 1. / 2) / Step 3 / Step 4: with their continuation lines; a skipped number is noted', () => {
  const d = draftPlan(STOOL, TOOLS)
  expect(d.plan.steps.map(s => s.text)).toEqual([
    'Cut all parts to length.',
    'Cut a V notch in the bottom of each side, about 2" deep.',
    'Drill pocket holes in the aprons.',
    'Attach the aprons to the sides with glue and screws.',
    'Sand smooth and finish.'
  ])
  expect(d.notes).toContain('Step numbers jump from 4 to 6 — a step may be missing.')
})

test('tools and materials are picked out', () => {
  const d = draftPlan(STOOL, TOOLS)
  expect(d.plan.tools).toEqual(['drill', 'jigsaw', 'tape-measure'])
  expect(d.plan.materials).toEqual([
    { text: '1-1/4" pocket screws', amount: '24' },
    { text: 'Wood glue', amount: '' }
  ])
})

test('everything drafted starts unchecked and points back to its source line', () => {
  const d = draftPlan(STOOL, TOOLS)
  const ids = [...d.plan.steps.map(s => s.id), ...d.plan.cutRows.map(r => r.id)]
  expect(d.plan.unchecked.sort()).toEqual(ids.sort())
  for (const id of ids) expect(d.plan.review!.some(r => r.itemId === id && r.page === 1)).toBe(true)
})

test('a Qty / Part / T / W / L table drafts its rows', () => {
  expect(rowsOf(draftPlan(TABLE, TOOLS))).toEqual([
    [2, 'Side', 0.75, 11.25, 36, ''],
    [3, 'Shelf', 0.75, 11.25, 28.5, ''],
    [1, 'Back', 0.25, 29.25, 36, '']
  ])
})

test('a number the reader was unsure of is flagged, not trusted', () => {
  const d = draftPlan(UNCERTAIN, TOOLS)
  const r = d.plan.cutRows[0]
  expect(d.flags[r.id]).toMatch(/unsure/)
})

test('a doubled "x" from the reader ("%x", "X%") still reads as one ×', () => {
  const lines = ['Stool', '1-3/4x11-1/4%x 16" Top', '1-3/4x5-1/2X% 14-1/2" Step'].map((text, i) => ({ text, page: 1, box: [0, i * 20, 100, 12] as [number, number, number, number] }))
  expect(draftPlan(lines, {}).plan.cutRows.map(r => [r.qty, r.part, r.thickness, r.width, r.length])).toEqual([
    [1, 'Top', 0.75, 11.25, 16],
    [1, 'Step', 0.75, 5.5, 14.5]
  ])
})
