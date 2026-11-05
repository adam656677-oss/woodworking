import { beforeAll, expect, test } from 'vitest'
import { emptyProject } from '../../src/model/woods'
import { applyTemplate } from '../../src/templates'
import { buildPlanIssues, createBuildPlan, isBuildPlanCurrent } from '../../src/drawings/buildPlan'

const model = () => applyTemplate(emptyProject('Box'), 'box', {})
let result: ReturnType<typeof createBuildPlan>
let source: ReturnType<typeof model>
let before: string
beforeAll(() => {
  source = model()
  before = JSON.stringify(source)
  result = createBuildPlan(source, { paper: 'letter', scale: 'auto', hidden: true, date: '2026-11-03' })
}, 60_000)

test('creates drawings, numbered part records, cut list, and steps from one model', () => {
  if (!result.ok) throw new Error(result.issues.join('; '))
  expect(result.plan.sheets).toHaveLength(4 + result.plan.parts.length)
  expect(result.plan.sheets[0].title).toBe('Cover')
  result.plan.parts.forEach((part, index) => {
    expect(part.no).toBe(index + 1)
    expect(result.ok && result.plan.cutList.rows[index].boardIds).toContain(part.boardId)
  })
  expect(result.plan.steps.length).toBeGreaterThan(0)
  expect(JSON.stringify(source)).toBe(before)
})

test('detects when the source model changes without changing the existing plan', () => {
  if (!result.ok) throw new Error(result.issues.join('; '))
  expect(isBuildPlanCurrent(result.plan, source)).toBe(true)
  const changed = { ...source, boards: source.boards.map((board, index) => index ? board : { ...board, length: board.length + 1 }) }
  expect(isBuildPlanCurrent(result.plan, changed)).toBe(false)
  expect(result.plan.sourceSnapshot).toBe(before)
})

test('rejects empty projects before attempting drawings', () => {
  const empty = createBuildPlan(emptyProject('Empty'), { paper: 'letter', scale: 'auto', hidden: true, date: '2026-11-03' })
  expect(empty.ok).toBe(false)
})

test('reports invalid sizes and missing materials without inventing replacements', () => {
  const project = model()
  const bad = { ...project, boards: [{ ...project.boards[0], width: Number.NaN, woodId: 'missing-material' }] }
  expect(buildPlanIssues(bad).join(' ')).toContain('positive finite measurements')
  expect(buildPlanIssues(bad).join(' ')).toContain('choose an existing material')
})

// ---- Hardware appendix, full-size templates and pagination ----
import { addSketch, shapeBoard } from '../../src/model/shaped'
import { addDoors, DOOR_DEFAULTS } from '../../src/cabinet/doors'
import { hardwareList } from '../../src/cabinet/hardware'
import { joineryHardware } from '../../src/joinery/cuts'
import { cutList } from '../../src/model/cutlist'
import { apron } from '../sketch/fixtures'
import type { Project } from '../../src/model/types'

const opts = { paper: 'letter' as const, scale: 'auto' as const, hidden: true, date: '2026-11-03' }
const make = (p: Project) => { const r = createBuildPlan(p, opts); if (!r.ok) throw new Error(r.issues.join('; ')); return r.plan }
const withDoor = (): Project => {
  const r = addDoors(emptyProject('Cabinet'), { x: 0, y: 0, z: 0, width: 15, height: 30 }, { ...DOOR_DEFAULTS })
  if ('error' in r) throw new Error(r.error)
  return r.project
}
const withApron = (): Project => {
  const r = shapeBoard(addSketch(emptyProject('Apron'), apron()), null, 'k1', '1x6')
  if ('error' in r) throw new Error(r.error)
  return r.project
}
const contents = (svg: string) => svg.replace(/<[^>]+>/g, '|').split('|').map(s => s.trim()).filter(Boolean)

test('hardware appendix reuses the project hardware list and joint hardware', () => {
  const door = withDoor()
  const plan = make(door)
  const want = hardwareList(door)
  expect(want.rows.length).toBeGreaterThan(0)
  expect(plan.hardware.rows).toEqual(want.rows)
  expect(plan.hardware.total).toBe(want.total)
  expect(plan.hardware.joints).toEqual(joineryHardware(door))
  expect(plan.hardware.rows.some(r => /hinge/i.test(r.name))).toBe(true)
})

test('a project without hardware says so and the cover still lists the appendix', () => {
  const plan = make(model())
  expect(plan.hardware.rows).toEqual([])
  expect(plan.hardware.joints).toEqual([])
  expect(contents(plan.sheets[0].svg)).toContain('•  Appendix: hardware list')
})

test('only shaped parts get full-size templates, each with the true 1 inch check square', () => {
  expect(make(model()).templates).toEqual([])
  expect(contents(make(model()).sheets[0].svg).join(' ')).not.toContain('Full-size templates')
  const project = withApron()
  const plan = make(project)
  expect(plan.templates).toHaveLength(1)
  const t = plan.templates[0]
  expect(t.boardId).toBe(project.boards[0].id)
  expect(t.no).toBe(1)
  expect(t.pages.length).toBeGreaterThan(1)
  expect(t.pages[0]).toContain('width="1" height="1"')
  for (const page of t.pages) expect(page).toMatch(/^<svg[^>]*width="8.5in" height="11in"/)
  expect(contents(plan.sheets[0].svg).join(' ')).toContain('Full-size templates')
})

test('sheet numbering stays n of N with appendices and templates; part IDs agree everywhere', () => {
  for (const project of [model(), withDoor(), withApron()]) {
    const plan = make(project)
    const total = plan.sheets.length
    plan.sheets.forEach((sheet, index) => expect(contents(sheet.svg)).toContain(`${index + 1} of ${total}`))
    expect(total).toBe(4 + plan.parts.length)
    const rows = cutList(project).rows
    plan.parts.forEach((part, index) => {
      expect(part.no).toBe(index + 1)
      expect(rows[index].boardIds[0]).toBe(part.boardId)
      expect(plan.sheets[4 + index].title.startsWith(`Part P${part.no} — `)).toBe(true)
    })
    for (const t of plan.templates) {
      const part = plan.parts.find(q => q.boardId === t.boardId)!
      expect(t.no).toBe(part.no)
      expect(t.name.startsWith(`P${part.no} `)).toBe(true)
    }
  }
})

test('every drawing sheet is landscape letter; templates are portrait letter', () => {
  const plan = make(withApron())
  for (const sheet of plan.sheets) { expect(sheet.paper).toBe('letter'); expect(sheet.svg).toMatch(/^<svg[^>]*width="11in" height="8.5in"/) }
  for (const page of plan.templates.flatMap(t => t.pages)) expect(page).toMatch(/^<svg[^>]*width="8.5in" height="11in"/)
})
