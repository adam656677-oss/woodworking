// Editing named sizes and formulas. All pure: each returns a new project (or a plain error).
import { updateJoint, type OpError } from '../model/ops'
import type { Project } from '../model/types'
import { FUNCTIONS } from './expr'
import { worldBox } from '../model/geometry'
import { controlledBy, removeRule } from './rules'
import { AXES3 } from './types'
import { fieldLabel, hasFormulas, partNameOf } from './recalc'

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

/**
 * A dado/rabbet size typed as a plain number. Where formulas re-seat grooves, a typed width or offset is kept as a
 * fixed formula so the next recalculation doesn't measure it again from the partner.
 */
export function setGrooveValue(p: Project, jointId: string, field: 'width' | 'depth' | 'offset', v: number): Project | OpError {
  let q = setJointFormula(p, jointId, field, null)
  const r = updateJoint(q, jointId, { [field]: v })
  if ('error' in r) return r
  q = r
  if (field !== 'depth' && hasFormulas(p)) q = setJointFormula(q, jointId, field, exactText(v))
  return q
}

/** A number as formulas read it, exact on the 1/64" grid (49/64, 10, 3/2); otherwise a decimal. */
export function exactText(v: number): string {
  if (Math.abs(v * 64 - Math.round(v * 64)) > 1e-9) return String(Math.round(v * 1e6) / 1e6)
  let n = Math.round(Math.abs(v) * 64), d = 64
  while (n % 2 === 0 && d > 1) { n /= 2; d /= 2 }
  return `${v < 0 ? '-' : ''}${d === 1 ? n : `${n}/${d}`}`
}

/**
 * Drops the formulas and rules behind any size or place that changed from prev to next (the kids' designer, where an
 * edit always wins, as answering "Replace" does in the Master Shop).
 */
export function releaseEdited(prev: Project, next: Project): Project {
  if (!hasFormulas(next)) return next
  let q = next
  const before = new Map(prev.boards.map(b => [b.id, b]))
  for (const b of next.boards) {
    const old = before.get(b.id)
    if (!old) continue
    const ob = worldBox(old), nb = worldBox(b)
    for (const k of ['width', 'length'] as const) if (old[k] !== b[k] && b.formulas?.[k]) q = setBoardFormula(q, b.id, k, null)
    for (const a of AXES3) {
      if (Math.abs(ob.min[a] - nb.min[a]) < 1e-9) continue
      if (b.formulas?.[a]) q = setBoardFormula(q, b.id, a, null)
      const r = controlledBy(q, b.id, a)
      if (r) q = removeRule(q, r.id)
    }
  }
  const jBefore = new Map(prev.joints.map(j => [j.id, j]))
  for (const j of next.joints) {
    const old = jBefore.get(j.id)
    if (!old || !j.formulas) continue
    for (const k of Object.keys(j.formulas)) if (getNum(old.params, k) !== getNum(j.params, k)) q = setJointFormula(q, j.id, k, null)
  }
  return q
}
const getNum = (o: unknown, k: string) => (o as Record<string, unknown>)[k]
