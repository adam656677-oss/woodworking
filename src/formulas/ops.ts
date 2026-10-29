// Editing named sizes and formulas. All pure: each returns a new project (or a plain error).
import type { OpError } from '../model/ops'
import type { Project } from '../model/types'
import { FUNCTIONS } from './expr'
import { fieldLabel, partNameOf } from './recalc'

const NAME = /^[A-Za-z][A-Za-z0-9_]*$/
const strip = (expr: string) => expr.trim().replace(/^=\s*/, '')

export function sizeNameProblem(p: Project, name: string, except?: string): string | null {
  if (!NAME.test(name)) return 'Size names start with a letter and use letters, numbers and _'
  if (FUNCTIONS.includes(name.toLowerCase())) return `'${name}' is the name of a formula function — pick another`
  if (name.toLowerCase() === 'wood') return "'Wood' is used for wood sizes — pick another"
  if ((p.sizes ?? []).some(s => s.name.toLowerCase() === name.toLowerCase() && s.name.toLowerCase() !== except?.toLowerCase())) return `There is already a size called ${name}`
  return null
}

/** Adds a size, or changes an existing one's formula. */
export function setSize(p: Project, name: string, expr: string): Project | OpError {
  const sizes = p.sizes ?? []
  const i = sizes.findIndex(s => s.name.toLowerCase() === name.toLowerCase())
  if (i < 0) {
    const problem = sizeNameProblem(p, name)
    if (problem) return { error: problem }
    return { ...p, sizes: [...sizes, { name, expr: strip(expr) }] }
  }
  return { ...p, sizes: sizes.map((s, k) => (k === i ? { ...s, expr: strip(expr) } : s)) }
}

/** The name as a whole word in a formula (not part of a longer name, a part's field or a function call). */
const word = (name: string) => new RegExp(`(?<![A-Za-z0-9_.#])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z0-9_.#(])`, 'gi')

function rewriteAll(p: Project, fn: (expr: string) => string): Project {
  const f = (r?: Record<string, string>) => (r ? Object.fromEntries(Object.entries(r).map(([k, v]) => [k, fn(v)])) : r)
  return {
    ...p,
    sizes: p.sizes?.map(s => ({ ...s, expr: fn(s.expr) })),
    boards: p.boards.map(b => (b.formulas ? { ...b, formulas: f(b.formulas) } : b)),
    joints: p.joints.map(j => (j.formulas ? { ...j, formulas: f(j.formulas) } : j)),
    rules: p.rules?.map(r => (r.kind === 'count' ? { ...r, expr: fn(r.expr) } : r.kind === 'gap' && r.gapExpr ? { ...r, gapExpr: fn(r.gapExpr) } : r))
  }
}

export function renameSize(p: Project, from: string, to: string): Project | OpError {
  const s = (p.sizes ?? []).find(x => x.name.toLowerCase() === from.toLowerCase())
  if (!s) return { error: `There is no size called ${from}` }
  const problem = sizeNameProblem(p, to, from)
  if (problem) return { error: problem }
  const re = word(from)
  const q = rewriteAll(p, e => e.replace(re, to))
  return { ...q, sizes: q.sizes!.map(x => (x.name === s.name ? { ...x, name: to } : x)) }
}

/** Where a size is used, for the "used by" message. */
export function formulaUsers(p: Project, name: string): string[] {
  const used = (e: string) => word(name).test(e)
  const out: string[] = []
  for (const s of p.sizes ?? []) if (s.name.toLowerCase() !== name.toLowerCase() && used(s.expr)) out.push(s.name)
  for (const b of p.boards) for (const [path, e] of Object.entries(b.formulas ?? {})) if (used(e)) out.push(`${partNameOf(p, b.id)} (${fieldLabel(path)})`)
  for (const j of p.joints) for (const [path, e] of Object.entries(j.formulas ?? {})) if (used(e)) out.push(`a joint on ${partNameOf(p, j.hostBoardId)} (${path})`)
  for (const r of p.rules ?? []) {
    const e = r.kind === 'count' ? r.expr : r.kind === 'gap' ? r.gapExpr ?? '' : ''
    if (e && used(e)) out.push(`a ${r.kind} rule`)
  }
  return out
}

export function deleteSize(p: Project, name: string): Project | OpError {
  const s = (p.sizes ?? []).find(x => x.name.toLowerCase() === name.toLowerCase())
  if (!s) return p
  const users = formulaUsers(p, s.name)
  if (users.length) return { error: `${s.name} is used by: ${users.join(', ')}` }
  return { ...p, sizes: p.sizes!.filter(x => x !== s) }
}

export function setBoardFormula(p: Project, id: string, path: string, expr: string | null): Project {
  return {
    ...p,
    boards: p.boards.map(b => {
      if (b.id !== id) return b
      const formulas = { ...(b.formulas ?? {}) }
      if (expr === null) delete formulas[path]
      else formulas[path] = strip(expr)
      if (!Object.keys(formulas).length) { const { formulas: _f, ...rest } = b; return rest }
      return { ...b, formulas }
    })
  }
}

export function setJointFormula(p: Project, id: string, path: string, expr: string | null): Project {
  return {
    ...p,
    joints: p.joints.map(j => {
      if (j.id !== id) return j
      const formulas = { ...(j.formulas ?? {}) }
      if (expr === null) delete formulas[path]
      else formulas[path] = strip(expr)
      if (!Object.keys(formulas).length) { const { formulas: _f, ...rest } = j; return rest }
      return { ...j, formulas }
    })
  }
}
