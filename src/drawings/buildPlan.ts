import type { Project } from '../model/types'
import { cutList } from '../model/cutlist'
import { stepsFromDesign } from '../shop/steps'
import { coverSheet, drawingSheets, partList, type SheetOpts } from './views'

export function buildPlanIssues(project: Project): string[] {
  if (!project.boards.length) return ['Add at least one modeled part before creating a build plan.']
  const issues: string[] = []
  const ids = new Set<string>()
  for (const board of project.boards) {
    if (ids.has(board.id)) issues.push(`Duplicate part ID: ${board.id}.`)
    ids.add(board.id)
    if (![board.width, board.length, board.thickness].every(value => Number.isFinite(value) && value > 0)) {
      issues.push(`${board.name}: width, length, and thickness must be positive finite measurements.`)
    }
    if (![board.position.x, board.position.y, board.position.z, board.rotation.x, board.rotation.y, board.rotation.z].every(Number.isFinite)) {
      issues.push(`${board.name}: position and rotation must be finite measurements.`)
    }
    if (!project.woods.some(wood => wood.id === board.woodId)) issues.push(`${board.name}: choose an existing material.`)
  }
  return issues
}

/** Produces outputs from one immutable model snapshot; it never creates another editable design. */
export function createBuildPlan(project: Project, options: SheetOpts) {
  const issues = buildPlanIssues(project)
  if (issues.length) return { ok: false as const, issues }
  const sourceSnapshot = JSON.stringify(project)
  const model = JSON.parse(sourceSnapshot) as Project
  const parts = partList(model)
  const total = 4 + parts.length
  const sheets = drawingSheets(model, { views: true, exploded: true, section: true, parts: 'all' }, options, { first: 2, total })
  const cover = coverSheet(model, options, ['Assembly views', 'Exploded view and section', 'Dimensioned part sheets', 'Cut list', 'Assembly guidance'], `1 of ${total}`)
  return { ok: true as const, plan: {
    name: model.name, sourceSnapshot, options: { ...options },
    sheets: [cover, ...sheets], parts, cutList: cutList(model), steps: stepsFromDesign(model),
    reviewNotes: ['Review joints, dimensions, and assembly order before fabrication. This plan is not a structural safety certification.']
  } }
}

/** Conservative invalidation: any serialized project change requires regeneration. */
export function isBuildPlanCurrent(plan: { sourceSnapshot: string }, project: Project): boolean {
  return plan.sourceSnapshot === JSON.stringify(project)
}
