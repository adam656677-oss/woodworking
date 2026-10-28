// Templates: recipes that turn a few numbers into boards and joints. A template stays live until Unlock.
import type { Board, Joint, Project, Wood } from '../model/types'
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
  /** Raise sizes that are too small for the chosen wood (e.g. a box narrower than two walls). */
  adjust?(params: Record<string, ParamValue>, woods: Wood[]): Record<string, ParamValue>
}

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

/** Turn a live template into plain boards and joints for free-form editing. */
export function unlock(project: Project): Project {
  const { template: _t, ...rest } = project
  return rest
}
