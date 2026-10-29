// Templates: recipes that turn a few numbers into boards and joints. A template stays live until Unlock.
import type { Board, Joint, Project, Wood } from '../model/types'
import type { NewRule, SizeDef } from '../formulas/types'
import { recalc } from '../formulas/recalc'
import { formulaName } from '../formulas/recalc'
import { birdhouse } from './birdhouse'
import { bookshelf } from './bookshelf'
import { box } from './box'

export type ParamValue = number | boolean | string
export type ParamDef = {
  key: string
  label: string
  kind: 'inches' | 'count' | 'bool' | 'wood' | 'choice'
  default: ParamValue
  min?: number
  max?: number
  options?: string[]
}

export type TemplateDef = {
  id: 'box' | 'bookshelf' | 'birdhouse'
  name: string
  params: ParamDef[]
  build(params: Record<string, ParamValue>, woods: Wood[]): { boards: Board[]; joints: Joint[] }
  /**
   * The template written as named sizes, formulas and rules (used by Unlock). Boards and joints are by their index in
   * what `build` returns; a rule's parts are board indexes too.
   */
  unlockForm(params: Record<string, ParamValue>, woods: Wood[]): UnlockForm
  /** Raise sizes that are too small for the chosen wood (e.g. a box narrower than two walls). */
  adjust?(params: Record<string, ParamValue>, woods: Wood[]): Record<string, ParamValue>
}

/** A layout rule whose parts are given as board indexes (numbers) instead of ids. */
export type IndexRule = { kind: NewRule['kind'] } & Record<string, unknown>
export type UnlockForm = { sizes: SizeDef[]; boards: Record<number, Record<string, string>>; joints?: Record<number, Record<string, string>>; rules?: IndexRule[] }

/** A number as a formula writes it. */
export const num = (v: number) => String(Math.round(v * 1e6) / 1e6)
/** The formula name for a wood's thickness. */
export const woodT = (id: string) => `Wood.${formulaName(id)}.T`

export const TEMPLATES: TemplateDef[] = [box, bookshelf, birdhouse]

export function findTemplate(id: string): TemplateDef | undefined {
  return TEMPLATES.find(t => t.id === id)
}

/** Defaults merged with `given`, numbers clamped to each parameter's range, counts rounded. */
export function resolveParams(def: TemplateDef, given: Record<string, ParamValue> = {}): Record<string, ParamValue> {
  const out: Record<string, ParamValue> = {}
  for (const p of def.params) {
    let v = given[p.key] ?? p.default
    if (p.kind === 'inches' || p.kind === 'count') {
      let n = typeof v === 'number' && Number.isFinite(v) ? v : (p.default as number)
      if (p.kind === 'count') n = Math.round(n)
      if (p.min !== undefined) n = Math.max(p.min, n)
      if (p.max !== undefined) n = Math.min(p.max, n)
      v = n
    } else if (p.kind === 'bool') {
      v = Boolean(v)
    } else if (p.kind === 'choice' && !p.options?.includes(String(v))) {
      v = p.default
    }
    out[p.key] = v
  }
  return out
}

/** Replace the project's boards and joints with a live template. */
export function applyTemplate(project: Project, id: string, params: Record<string, ParamValue> = {}): Project {
  const def = findTemplate(id)
  if (!def) throw new Error(`Unknown template ${id}`)
  const base = resolveParams(def, params)
  const resolved = def.adjust ? def.adjust(base, project.woods) : base
  const { boards, joints } = def.build(resolved, project.woods)
  return { ...project, boards, joints, template: { templateId: id, params: resolved } }
}

/** Change a live template's parameters and regenerate. Unlocked projects are returned unchanged. */
export function updateTemplateParams(project: Project, patch: Record<string, ParamValue>): Project {
  if (!project.template) return project
  return applyTemplate(project, project.template.templateId, { ...project.template.params, ...patch })
}

/**
 * Unlock a live template: its settings become named sizes and its parts formulas and rules, so it still resizes
 * but every part can now be edited freely.
 */
export function unlock(project: Project): Project {
  const { template, ...rest } = project
  const def = template && findTemplate(template.templateId)
  if (!template || !def) return rest
  const form = def.unlockForm(template.params, project.woods)
  const ids = rest.boards.map(b => b.id)
  const boards = rest.boards.map((b, i) => (form.boards[i] ? { ...b, formulas: { ...form.boards[i] } } : b))
  const joints = rest.joints.map((j, i) => (form.joints?.[i] ? { ...j, formulas: { ...form.joints[i] } } : j))
  const idOf = (v: unknown) => (typeof v === 'number' ? ids[v] : v)
  const rules = (form.rules ?? []).map((r, k) => {
    const out: Record<string, unknown> = { id: `r_${template.templateId}_${k}` }
    for (const [key, v] of Object.entries(r)) out[key] = Array.isArray(v) && key !== 'axes' ? v.map(idOf) : key === 'kind' || key === 'expr' || key === 'gapExpr' || key === 'side' || key === 'axis' || key === 'gap' ? v : idOf(v)
    return out
  }) as Project['rules']
  const next: Project = { ...rest, boards, joints, sizes: form.sizes, ...(rules && rules.length ? { rules } : {}) }
  return recalc(next).project
}
