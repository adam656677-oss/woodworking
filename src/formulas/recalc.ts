// Recalculation: named sizes, then every formula on boards and joints, in dependency order.
// (Layout rules and joints-follow run after this — see rules.ts and reseat.ts.)
import { worldBox } from '../model/geometry'
import type { Board, Joint, Project } from '../model/types'
import { formatInches, snap64 } from '../model/units'
import { turnBoard } from '../shaping/turning'
import { updateJoint } from '../model/ops'
import { evalFormula, namesIn, parseFormula, type Expr } from './expr'
import { applyRules } from './rules'
import { reseatGrooves } from './reseat'

export type FormulaError = { key: string; message: string; boardIds: string[] }

const FIELD_LABELS: Record<string, string> = {
  width: 'Width', length: 'Length', x: 'X', y: 'Y', z: 'Z',
  'turning.top': 'Top pommel', 'turning.bottom': 'Square foot', 'turning.maxD': 'Biggest diameter', 'turning.minD': 'Smallest diameter',
  'taper.start': 'Taper start', 'taper.foot': 'Size at the foot'
}
export function fieldLabel(path: string): string {
  if (FIELD_LABELS[path]) return FIELD_LABELS[path]
  const h = /^holes\.\d+\.(u|v|diameter)$/.exec(path)
  if (h) return h[1] === 'diameter' ? 'Hole diameter' : h[1] === 'u' ? 'Hole across' : 'Hole along'
  if (/^edges\.\d+\.size$/.test(path)) return 'Profile size'
  return path
}
const JOINT_LABELS: Record<string, string> = { width: 'Groove width', depth: 'Groove depth', offset: 'Groove offset' }
/** Fields that must come out more than 0. */
const POSITIVE = (path: string) => !['x', 'y', 'z', 'turning.top', 'turning.bottom', 'taper.start', 'offset'].includes(path) && !/^holes\.\d+\.(u|v)$/.test(path)

/** A board or wood name as formulas spell it: spaces and other marks become _. */
export const formulaName = (s: string) => s.trim().replace(/[^A-Za-z0-9_]/g, '_').replace(/^(?=\d)/, '_')

/** Part names for formulas (lower-case), with #2, #3… for repeats in board order → board id. */
export function partNames(p: Project): Map<string, string> {
  const out = new Map<string, string>()
  const seen = new Map<string, number>()
  for (const b of p.boards) {
    const base = formulaName(b.name).toLowerCase()
    const n = (seen.get(base) ?? 0) + 1
    seen.set(base, n)
    if (n === 1) out.set(base, b.id)
    out.set(`${base}#${n}`, b.id)
  }
  return out
}
/** How a part is named in formulas (Side, Side#2). */
export function partNameOf(p: Project, id: string): string {
  const b = p.boards.find(x => x.id === id)
  if (!b) return '?'
  const base = formulaName(b.name)
  const same = p.boards.filter(x => formulaName(x.name).toLowerCase() === base.toLowerCase())
  const i = same.findIndex(x => x.id === id)
  return i <= 0 ? base : `${base}#${i + 1}`
}

export const hasFormulas = (p: Project) =>
  !!(p.sizes?.length || p.rules?.length || p.boards.some(b => b.formulas && Object.keys(b.formulas).length) || p.joints.some(j => j.formulas && Object.keys(j.formulas).length))

function getPath(o: any, path: string): number | undefined {
  const v = path.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o)
  return typeof v === 'number' ? v : undefined
}
function setPath<T>(o: T, path: string, v: number): T {
  const keys = path.split('.')
  const copy = (x: any): any => (Array.isArray(x) ? [...x] : { ...x })
  const root = copy(o)
  let cur = root
  for (let i = 0; i < keys.length - 1; i++) {
    if (cur[keys[i]] == null) return o
    cur[keys[i]] = copy(cur[keys[i]])
    cur = cur[keys[i]]
  }
  cur[keys[keys.length - 1]] = v
  return root
}

type Node = { key: string; label: string; expr: string; parsed?: Expr; deps: string[]; boardIds: string[] }

/** Sizes and formula fields, worked out in order. Returns the same project when it has none. */
export function recalcFormulas(p0: Project): { project: Project; errors: FormulaError[]; sizes: Map<string, number> } {
  if (!hasFormulas(p0)) return { project: p0, errors: [], sizes: new Map() }
  let p = p0
  const errors: FormulaError[] = []
  const names = partNames(p)
  const nodes = new Map<string, Node>()
  const sizeVals = new Map<string, number>()

  for (const s of p.sizes ?? []) nodes.set(`size:${s.name.toLowerCase()}`, { key: `size:${s.name.toLowerCase()}`, label: s.name, expr: s.expr, deps: [], boardIds: [] })
  for (const b of p.boards) for (const [path, expr] of Object.entries(b.formulas ?? {})) {
    nodes.set(`board:${b.id}:${path}`, { key: `board:${b.id}:${path}`, label: `${partNameOf(p, b.id)} ${fieldLabel(path)}`, expr, deps: [], boardIds: [b.id] })
  }
  for (const j of p.joints) for (const [path, expr] of Object.entries(j.formulas ?? {})) {
    nodes.set(`joint:${j.id}:${path}`, { key: `joint:${j.id}:${path}`, label: JOINT_LABELS[path] ?? path, expr, deps: [], boardIds: [j.hostBoardId, j.partnerBoardId] })
  }
  // What each name a formula uses depends on.
  const nodeFor = (name: string): string[] => {
    if (nodes.has(`size:${name}`)) return [`size:${name}`]
    const m = /^(.+)\.(width|length|thickness|x|y|z)$/.exec(name)
    if (m && names.has(m[1])) {
      const id = names.get(m[1])!
      const f = (path: string) => (nodes.has(`board:${id}:${path}`) ? [`board:${id}:${path}`] : [])
      if (m[2] === 'width' || m[2] === 'length') return f(m[2])
      if (m[2] === 'thickness') return []
      return [...f(m[2]), ...f('width'), ...f('length')]
    }
    return []
  }
  for (const n of nodes.values()) {
    const r = parseFormula(n.expr)
    if (!r.ok) { errors.push({ key: n.key, message: r.error, boardIds: n.boardIds }); continue }
    n.parsed = r.expr
    n.deps = namesIn(r.expr).flatMap(nodeFor)
    // A position is the box's low corner, which moves when the part's own size changes (a turned part).
    const own = /^board:(.+):(x|y|z)$/.exec(n.key)
    if (own) for (const f of ['width', 'length']) if (nodes.has(`board:${own[1]}:${f}`)) n.deps.push(`board:${own[1]}:${f}`)
  }
  // Order, finding loops.
  const order: Node[] = []
  const state = new Map<string, 'busy' | 'done'>()
  const stack: string[] = []
  const inLoop = new Set<string>()
  const visit = (key: string) => {
    const s = state.get(key)
    if (s === 'done') return
    if (s === 'busy') {
      const loop = stack.slice(stack.indexOf(key))
      const text = `These sizes depend on each other: ${[...loop, key].map(k => nodes.get(k)!.label).join(' → ')}`
      for (const k of loop) if (!inLoop.has(k)) { inLoop.add(k); errors.push({ key: k, message: text, boardIds: nodes.get(k)!.boardIds }) }
      return
    }
    state.set(key, 'busy')
    stack.push(key)
    for (const d of nodes.get(key)!.deps) visit(d)
    stack.pop()
    state.set(key, 'done')
    order.push(nodes.get(key)!)
  }
  for (const k of nodes.keys()) visit(k)

  const lookup = (name: string) => makeLookup(p, sizeVals)(name)
  // Sizes without a good value still answer with what they last were (so dependents keep working).
  const touched = new Set<string>()
  for (const n of order) {
    if (!n.parsed || inLoop.has(n.key)) {
      if (n.key.startsWith('size:')) { const r = n.parsed && evalFormula(n.parsed, () => undefined); if (r && r.ok) sizeVals.set(n.key.slice(5), r.value) }
      continue
    }
    const r = evalFormula(n.parsed, lookup)
    if (!r.ok) { errors.push({ key: n.key, message: r.error, boardIds: n.boardIds }); continue }
    if (n.key.startsWith('size:')) { sizeVals.set(n.key.slice(5), r.value); continue }
    const [kind, id, path] = n.key.split(':')
    const v = snap64(r.value)
    if (POSITIVE(path) && !(v > 0)) {
      const label = kind === 'joint' ? JOINT_LABELS[path] ?? path : fieldLabel(path)
      errors.push({ key: n.key, message: `${label} works out to ${formatInches(r.value)} — it must be more than 0"`, boardIds: n.boardIds })
      continue
    }
    if (kind === 'board') {
      p = { ...p, boards: p.boards.map(b => (b.id === id ? applyBoardValue(b, path, v) : b)) }
      touched.add(id)
    } else {
      p = setJointValue(p, id, path, v)
    }
  }
  // A ready-made turning is redrawn for its new sizes.
  for (const id of touched) {
    const b = p.boards.find(x => x.id === id)!
    const t = b.turning
    if (!t || t.style === 'custom') continue
    const r = turnBoard(p, id, { style: t.style, top: t.top, bottom: t.bottom, shoulder: t.shoulder, maxD: t.maxD, minD: t.minD })
    if ('error' in r) errors.push({ key: `board:${id}:turning`, message: r.error, boardIds: [id] })
    else p = r.project
  }
  return { project: p, errors, sizes: sizeVals }
}

/**
 * A joint value from a formula. A dado/rabbet depth moves the partner in or out of the groove, as typing it does —
 * unless the partner's own size formula sets that size (it already counts the depth).
 */
function setJointValue(p: Project, id: string, path: string, v: number): Project {
  const j = p.joints.find(x => x.id === id)
  if (!j) return p
  if (path !== 'depth' || (j.type !== 'dado' && j.type !== 'rabbet') || getPath(j.params, 'depth') === v) {
    return { ...p, joints: p.joints.map(x => (x.id === id ? { ...x, params: setPath(x.params, path, v) } as Joint : x)) }
  }
  const before = p.boards.find(b => b.id === j.partnerBoardId)
  const next = updateJoint(p, id, { depth: v })
  const after = next.boards.find(b => b.id === j.partnerBoardId)
  if (!before || !after) return next
  const held = (['width', 'length'] as const).some(k => before[k] !== after[k] && before.formulas?.[k])
  return held ? { ...next, boards: next.boards.map(b => (b.id === before.id ? before : b)) } : next
}

function applyBoardValue(b: Board, path: string, v: number): Board {
  if (path === 'x' || path === 'y' || path === 'z') {
    const min = worldBox(b).min[path]
    return { ...b, position: { ...b.position, [path]: snap64(b.position[path] + v - min) } }
  }
  if (getPath(b, path) === undefined && path !== 'width' && path !== 'length') return b
  return setPath(b, path, v)
}

/** Looks up a name: a size's value, a part's size or place (X/Y/Z = its box's low corner), or a wood's T/W. */
export function makeLookup(p: Project, sizeVals: Map<string, number>): (name: string) => number | undefined {
  const names = partNames(p)
  return name => {
    if (sizeVals.has(name)) return sizeVals.get(name)
    const w = /^wood\.(.+)\.(t|w)$/.exec(name)
    if (w) {
      const wood = p.woods.find(x => formulaName(x.id).toLowerCase() === w[1])
      return wood ? (w[2] === 't' ? wood.thickness : wood.width) : undefined
    }
    const m = /^(.+)\.(width|length|thickness|x|y|z)$/.exec(name)
    if (m && names.has(m[1])) {
      const b = p.boards.find(x => x.id === names.get(m[1]))
      if (!b) return undefined
      if (m[2] === 'width' || m[2] === 'length' || m[2] === 'thickness') return b[m[2]]
      return worldBox(b).min[m[2] as 'x' | 'y' | 'z']
    }
    return undefined
  }
}

/** The whole recalculation: sizes and formulas, layout rules, then grooves follow their parts. */
export function recalc(p0: Project): { project: Project; errors: FormulaError[] } {
  if (!hasFormulas(p0)) return { project: p0, errors: [] }
  const a = recalcFormulas(p0)
  const b = applyRules(a.project, a.sizes)
  const project = reseatGrooves(b.project)
  return { project, errors: [...a.errors, ...b.errors] }
}
