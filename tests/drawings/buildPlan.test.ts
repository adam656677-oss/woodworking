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
