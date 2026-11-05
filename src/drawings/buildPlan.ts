import type { Project } from '../model/types'
import { cutList } from '../model/cutlist'
import { stepsFromDesign } from '../shop/steps'
import { hardwareList } from '../cabinet/hardware'
import { joineryHardware } from '../joinery/cuts'
import { shapedParts, templatesFor } from './tiles'
import { coverSheet, drawingSheets, partList, type SheetOpts } from './views'
import { createShoppingSnapshot, isShoppingSnapshotCurrent, type ShoppingInputs } from './shoppingSnapshot'

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

/** Drawing-sheet numbering excludes the flowing appendices and full-size templates, whose page counts depend on printing. */
export function createBuildPlan(project: Project, options: SheetOpts, shoppingInputs?: ShoppingInputs) {
  const issues = buildPlanIssues(project)
  if (issues.length) return { ok: false as const, issues }
  const sourceSnapshot = JSON.stringify(project)
  const model = JSON.parse(sourceSnapshot) as Project
  const shoppingSnapshot = createShoppingSnapshot(model, shoppingInputs)
  const parts = partList(model)
  const total = 4 + parts.length
  const sheets = drawingSheets(model, { views: true, exploded: true, section: true, parts: 'all' }, options, { first: 2, total })
  // Same model, same generators as the cut list and shopping list: hardware and joint supplies, and templates for shaped parts only.
  const hardware = { ...hardwareList(model), joints: joineryHardware(model) }
  const templates = templatesFor(model, shapedParts(model))
  const cover = coverSheet(model, options, [
    'Assembly views', 'Exploded view and section', 'Dimensioned part sheets',
    'Appendix: cut list', 'Appendix: shopping list', 'Appendix: hardware list', 'Appendix: assembly guidance',
    ...(templates.length ? [`Full-size templates (${templates.length} part${templates.length === 1 ? '' : 's'})`] : []),
    'Sheet numbers: drawings only', 'Appendices and templates are not numbered'
  ], `1 of ${total}`)
  return { ok: true as const, plan: {
    name: model.name, sourceSnapshot, options: { ...options },
    sheets: [cover, ...sheets], parts, cutList: cutList(model), steps: stepsFromDesign(model),
    shoppingSnapshot, hardware, templates,
    reviewNotes: ['Review joints, dimensions, and assembly order before fabrication. This plan is not a structural safety certification.', ...shoppingSnapshot.warnings]
  } }
}

/** Project and shop-input changes both require regeneration; legacy plans are stale. */
export function isBuildPlanCurrent(plan: { sourceSnapshot: string; shoppingSnapshot?: { inputsSnapshot: string | null } }, project: Project, shoppingInputs?: ShoppingInputs): boolean {
  return plan.sourceSnapshot === JSON.stringify(project)
    && plan.shoppingSnapshot !== undefined
    && isShoppingSnapshotCurrent(plan.shoppingSnapshot, shoppingInputs)
}

export type Plan = Extract<ReturnType<typeof createBuildPlan>, { ok: true }>['plan']
