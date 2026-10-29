// Layout rules: counts first (they add or remove parts), then spacing, centring and gaps in the order added.
import { worldBox, type Box } from '../model/geometry'
import { newId } from '../model/ids'
import type { OpError } from '../model/ops'
import type { Board, Joint, Project } from '../model/types'
import { formatInches, snap64 } from '../model/units'
import { evalFormula, parseFormula } from './expr'
import { makeLookup, type FormulaError } from './recalc'
import type { Axis3, NewRule, Rule } from './types'

const MAX_COUNT = 100
const AXIS_NAMES: Record<Axis3, string> = { x: 'across', y: 'front to back', z: 'up' }

const nameOf = (p: Project, id: string) => p.boards.find(b => b.id === id)?.name ?? '(missing part)'

export function ruleLabel(p: Project, r: Rule): string {
  switch (r.kind) {
    case 'spacing': return `Equal spacing (${nameOf(p, r.parts[0])}${r.parts.length > 1 ? ` ×${r.parts.length}` : ''})`
    case 'center': return `Centered (${nameOf(p, r.part)} on ${nameOf(p, r.on)})`
    case 'gap': return r.gap === 0 && !r.gapExpr ? `Flush (${nameOf(p, r.part)} with ${nameOf(p, r.to)})` : `Gap ${formatInches(r.gap)} (${nameOf(p, r.part)})`
    case 'count': return `Count =${r.expr} (${nameOf(p, r.first)})`
  }
}

/** Which parts a rule places, and along which axes. */
function claims(r: Rule): { part: string; axis: Axis3 }[] {
  switch (r.kind) {
    case 'spacing': return r.parts.map(part => ({ part, axis: r.axis }))
    case 'center': return r.axes.map(axis => ({ part: r.part, axis }))
    case 'gap': return [{ part: r.part, axis: r.axis }]
    case 'count': return [r.first, ...r.copies].map(part => ({ part, axis: r.axis }))
  }
}

/** The rule placing a part along an axis, if any (the first one wins). */
export function controlledBy(p: Project, boardId: string, axis: Axis3): Rule | null {
  return (p.rules ?? []).find(r => claims(r).some(c => c.part === boardId && c.axis === axis)) ?? null
}

const box = (p: Project, id: string): Box | null => {
  const b = p.boards.find(x => x.id === id)
  return b ? worldBox(b) : null
}
function moveMin(p: Project, id: string, axis: Axis3, min: number): Project {
  return {
    ...p,
    boards: p.boards.map(b => {
      if (b.id !== id) return b
      const now = worldBox(b).min[axis]
      return { ...b, position: { ...b.position, [axis]: snap64(b.position[axis] + snap64(min) - now) } }
    })
  }
}

/** Spreads parts evenly between the facing sides of two parts. Returns an error message, or null. */
function spaceBetween(p: Project, axis: Axis3, from: string, to: string, parts: string[]): { project: Project; error: string | null } {
  const F = box(p, from), T = box(p, to)
  if (!F || !T) return { project: p, error: 'A part this rule uses is missing' }
  const [lo, hi] = F.max[axis] <= T.min[axis] + 1e-9 ? [F.max[axis], T.min[axis]] : [T.max[axis], F.min[axis]]
  const run = parts.map(id => ({ id, b: box(p, id) })).filter((x): x is { id: string; b: Box } => !!x.b)
  run.sort((u, v) => (u.b.min[axis] + u.b.max[axis]) / 2 - (v.b.min[axis] + v.b.max[axis]) / 2)
  const sizes = run.map(x => x.b.max[axis] - x.b.min[axis])
  const gap = (hi - lo - sizes.reduce((s, v) => s + v, 0)) / (run.length + 1)
  if (gap < 0) return { project: p, error: `The parts don't fit between ${nameOf(p, from)} and ${nameOf(p, to)}` }
  // Positions on the 1/64" grid, mirrored for the far half so a symmetric run stays symmetric.
  const mins: number[] = []
  let at = lo
  run.forEach((_, i) => { at += gap; mins.push(snap64(at)); at += sizes[i] })
  const n = run.length
  for (let i = 0; i < n; i++) {
    const j = n - 1 - i
    if (i > j && Math.abs(sizes[i] - sizes[j]) < 1e-9) mins[i] = snap64(lo + hi - mins[j] - sizes[i])
  }
  let q = p
  run.forEach((x, i) => { q = moveMin(q, x.id, axis, mins[i]) })
  return { project: q, error: null }
}

/** A copy of a part for a count rule: same everything, its joints to parts outside the run repeated. */
function copyPart(p: Project, firstId: string, run: Set<string>): Project {
  const first = p.boards.find(b => b.id === firstId)!
  const id = newId('b')
  const copy: Board = { ...structuredClone(first), id }
  const joints: Joint[] = p.joints
    .filter(j => (j.hostBoardId === firstId && !run.has(j.partnerBoardId)) || (j.partnerBoardId === firstId && !run.has(j.hostBoardId)))
    .map(j => ({
      ...structuredClone(j),
      id: newId('j'),
      hostBoardId: j.hostBoardId === firstId ? id : j.hostBoardId,
      partnerBoardId: j.partnerBoardId === firstId ? id : j.partnerBoardId,
      restore: j.restore?.map(r => ({ ...r, boardId: r.boardId === firstId ? id : r.boardId }))
    }))
  // The new joints go right after the run's own, so notes keep the order they'd have if made by hand.
  const last = p.joints.reduce((k, j, i) => (run.has(j.hostBoardId) || run.has(j.partnerBoardId) ? i : k), p.joints.length - 1)
  const all = [...p.joints.slice(0, last + 1), ...joints, ...p.joints.slice(last + 1)]
  return { ...p, boards: [...p.boards, copy], joints: all }
}

export function applyRules(p0: Project, sizes: Map<string, number>): { project: Project; errors: FormulaError[] } {
  let p = p0
  const errors: FormulaError[] = []
  const rules = p.rules ?? []
  if (!rules.length) return { project: p, errors }
  const value = (expr: string) => {
    const r = parseFormula(expr)
    if (!r.ok) return r
    return evalFormula(r.expr, makeLookup(p, sizes))
  }
  const err = (r: Rule, message: string) => errors.push({ key: `rule:${r.id}`, message, boardIds: claims(r).map(c => c.part) })

  // Counts: add or remove copies.
  for (const r0 of rules) {
    if (r0.kind !== 'count') continue
    let r = r0
    if (!box(p, r.first) || !box(p, r.from) || !box(p, r.to)) { err(r, 'A part this rule uses is missing'); continue }
    const v = value(r.expr)
    let n = r.copies.length + 1
    if (!v.ok) err(r, v.error)
    else {
      n = Math.round(v.value)
      if (n < 1) { err(r, `Count works out to ${n} — it must be at least 1`); n = 1 }
      if (n > MAX_COUNT) { err(r, `Count works out to ${n} — ${MAX_COUNT} is the most`); n = MAX_COUNT }
    }
    let copies = r.copies.filter(id => box(p, id))
    while (copies.length + 1 < n) {
      const before = new Set(p.boards.map(b => b.id))
      // Copy the last of the run and start it just past it, so the run keeps its order when it's spaced.
      const lastId = copies.length ? copies[copies.length - 1] : r.first
      p = copyPart(p, lastId, new Set([r.first, ...copies]))
      const id = p.boards.find(b => !before.has(b.id))!.id
      const lb = box(p, lastId)!
      p = moveMin(p, id, r.axis, lb.max[r.axis])
      copies = [...copies, id]
    }
    if (copies.length + 1 > n) {
      const gone = new Set(copies.slice(n - 1))
      copies = copies.slice(0, n - 1)
      p = { ...p, boards: p.boards.filter(b => !gone.has(b.id)), joints: p.joints.filter(j => !gone.has(j.hostBoardId) && !gone.has(j.partnerBoardId)) }
    }
    r = { ...r, copies }
    p = { ...p, rules: (p.rules ?? []).map(x => (x.id === r.id ? r : x)) }
  }

  // Placement, checking that no two rules place the same part along the same axis.
  const owner = new Map<string, Rule>()
  const ordered: Rule[] = [...(p.rules ?? []).filter(x => x.kind === 'count'), ...(p.rules ?? []).filter(x => x.kind !== 'count')]
  for (const r of ordered) {
    const clash = claims(r).map(c => owner.get(`${c.part}:${c.axis}`)).find(Boolean)
    if (clash) { err(r, `These rules disagree: ${ruleLabel(p, clash)} and ${ruleLabel(p, r)} — remove one`); continue }
    for (const c of claims(r)) owner.set(`${c.part}:${c.axis}`, r)
    if (r.kind === 'count' || r.kind === 'spacing') {
      const parts = r.kind === 'count' ? [r.first, ...r.copies] : (r as Extract<Rule, { kind: 'spacing' }>).parts
      const s = spaceBetween(p, r.axis, r.from, r.to, parts)
      if (s.error) err(r, s.error)
      else p = s.project
    } else if (r.kind === 'center') {
      const on = box(p, r.on), me = box(p, r.part)
      if (!on || !me) { err(r, 'A part this rule uses is missing'); continue }
      for (const a of r.axes) p = moveMin(p, r.part, a, (on.min[a] + on.max[a]) / 2 - (me.max[a] - me.min[a]) / 2)
    } else {
      const to = box(p, r.to), me = box(p, r.part)
      if (!to || !me) { err(r, 'A part this rule uses is missing'); continue }
      let gap = r.gap
      if (r.gapExpr) {
        const v = value(r.gapExpr)
        if (v.ok) gap = snap64(v.value)
        else err(r, v.error)
      }
      const size = me.max[r.axis] - me.min[r.axis]
      p = moveMin(p, r.part, r.axis, r.side === 'max' ? to.max[r.axis] + gap : to.min[r.axis] - gap - size)
    }
  }
  return { project: p, errors }
}

export function addRule(p: Project, r: NewRule): Project | OpError {
  const ids = new Set(p.boards.map(b => b.id))
  const used = claimsOf(r as Rule).concat(refsOf(r as Rule))
  if (used.some(id => !ids.has(id))) return { error: 'Pick the parts for this rule' }
  if (r.kind === 'spacing' && (!r.parts.length || r.parts.includes(r.from) || r.parts.includes(r.to) || r.from === r.to)) return { error: 'Pick two end parts and the parts to space between them' }
  if ((r.kind === 'center' && r.part === r.on) || (r.kind === 'gap' && r.part === r.to)) return { error: 'Pick two different parts' }
  if (r.kind === 'center' && !r.axes.length) return { error: 'Pick at least one direction' }
  if (r.kind === 'count' && (r.first === r.from || r.first === r.to || r.from === r.to)) return { error: 'Pick the part to repeat and two different end parts' }
  const rule = { ...r, id: newId('r') } as Rule
  return { ...p, rules: [...(p.rules ?? []), rule] }
}
const claimsOf = (r: Rule) => claims(r).map(c => c.part)
const refsOf = (r: Rule): string[] => (r.kind === 'spacing' || r.kind === 'count' ? [r.from, r.to] : r.kind === 'center' ? [r.on] : [r.to])

export function removeRule(p: Project, id: string): Project {
  const rules = (p.rules ?? []).filter(r => r.id !== id)
  if (rules.length) return { ...p, rules }
  const { rules: _r, ...rest } = p
  return rest
}

/** Rules that name a part. */
export const rulesOn = (p: Project, boardId: string) => (p.rules ?? []).filter(r => claimsOf(r).includes(boardId) || refsOf(r).includes(boardId))

export { AXIS_NAMES }
