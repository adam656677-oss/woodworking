// .aaw project files: versioned JSON with structural checks, so a damaged file gives a plain message, not a crash.
import { CONSTRAINT_KINDS } from '../sketch/types'
import { EDGE_SIDES, FACES, PROFILE_KINDS, TURN_STYLES } from '../shaping/types'
import { AXES3 } from '../formulas/types'
import type { Project } from './types'
import { pruneGroups } from '../assemblies/ops'

export const FORMAT_VERSION = 6

export class ProjectFileError extends Error {
  constructor(public code: 'corrupt' | 'newerVersion' | 'invalid', message: string) {
    super(message)
    this.name = 'ProjectFileError'
  }
}

type Migration = (raw: any) => any
/** Step-by-step upgrades: MIGRATIONS[n] turns a version-n object into version n+1. */
const MIGRATIONS: Record<number, Migration> = {
  // Version 2 adds drawings.
  1: raw => ({ ...raw, formatVersion: 2, sketches: [] }),
  // Version 3 adds turned legs, tapers and edge profiles (all optional on boards).
  2: raw => ({ ...raw, formatVersion: 3 }),
  // Version 4 adds named sizes, formulas and layout rules (all optional).
  3: raw => ({ ...raw, formatVersion: 4 }),
  // Version 5 adds groups (assemblies) and linked copies (all optional).
  4: raw => ({ ...raw, formatVersion: 5 }),
  // Version 6 adds dimensions and notes on the model (optional).
  5: raw => ({ ...raw, formatVersion: 6 })
}

export function serialize(p: Project): string {
  return JSON.stringify(p, null, 2)
}

export function migrate(raw: any, migrations: Record<number, Migration> = MIGRATIONS): any {
  let r = raw
  while (typeof r.formatVersion === 'number' && r.formatVersion < FORMAT_VERSION) {
    const step = migrations[r.formatVersion]
    if (!step) throw new ProjectFileError('invalid', `This project's format (version ${r.formatVersion}) can't be upgraded.`)
    r = step(r)
  }
  return r
}

const isObj = (v: unknown): v is Record<string, any> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isVec = (v: unknown) => isObj(v) && isNum(v.x) && isNum(v.y) && isNum(v.z)
const isEnd = (v: unknown) => isObj(v) && isNum(v.miter) && isNum(v.bevel)

function invalid(msg: string): never {
  throw new ProjectFileError('invalid', `This file isn't a valid A&A project: ${msg}.`)
}

const oneOf = (v: unknown, options: string[]) => typeof v === 'string' && options.includes(v)
const isStr = (v: unknown): v is string => typeof v === 'string'

/** A drawing must be complete: numeric points, shapes that point at real points, known rule kinds. */
function checkSketch(s: any): void {
  if (!isObj(s) || !isStr(s.id) || !isStr(s.name) || !oneOf(s.mode, ['precise', 'freehand'])) invalid('a drawing is damaged')
  if (!Array.isArray(s.points) || !Array.isArray(s.entities) || !Array.isArray(s.constraints)) invalid(`drawing "${s.name}" is damaged`)
  const pts = new Set<string>()
  for (const p of s.points) {
    if (!isObj(p) || !isStr(p.id) || !isNum(p.x) || !isNum(p.y)) invalid(`drawing "${s.name}" has a damaged point`)
    pts.add(p.id)
  }
  const ids = new Set<string>(pts)
  const pt = (id: unknown) => isStr(id) && pts.has(id)
  for (const e of s.entities) {
    if (!isObj(e) || !isStr(e.id)) invalid(`drawing "${s.name}" has a damaged shape`)
    const ok =
      e.kind === 'line' ? pt(e.a) && pt(e.b)
        : e.kind === 'arc' ? pt(e.center) && pt(e.start) && pt(e.end)
          : e.kind === 'circle' ? pt(e.center) && isNum(e.r) && e.r > 0
            : e.kind === 'spline' ? Array.isArray(e.points) && e.points.length >= 2 && e.points.every(pt)
              : e.kind === 'text' ? pt(e.at) && isStr(e.text) && isNum(e.height) && e.height > 0
                : false
    if (!ok) invalid(`drawing "${s.name}" has a damaged shape`)
    ids.add(e.id)
  }
  for (const c of s.constraints) {
    if (!isObj(c) || !isStr(c.id) || !CONSTRAINT_KINDS.includes(c.kind) || !Array.isArray(c.refs) || !c.refs.every((r: unknown) => isStr(r) && ids.has(r)) || (c.value !== undefined && !isNum(c.value))) {
      invalid(`drawing "${s.name}" has a damaged dimension or rule`)
    }
  }
}

/** Each joint type's settings must be complete and numeric, or the app would show ?" sizes or worse. */
function jointParamsOk(type: string, p: Record<string, any>): boolean {
  switch (type) {
    case 'butt':
      return oneOf(p.fastener, ['glue', 'screws', 'nails']) && isNum(p.count)
    case 'dado':
    case 'rabbet':
      return isNum(p.width) && isNum(p.depth) && isNum(p.offset) && oneOf(p.face, ['top', 'bottom']) &&
        (p.along === undefined || oneOf(p.along, ['width', 'length']))
    case 'pocketScrew':
      return isNum(p.count) && isNum(p.spacing) && isNum(p.screwLength)
    case 'miter':
      return isNum(p.angle) && oneOf(p.fastener, ['glue', 'nails', 'splines'])
    default:
      return false
  }
}

function check(raw: any): Project {
  if (!isObj(raw)) invalid('it has no project data')
  if (typeof raw.name !== 'string') invalid('the project name is missing')
  if (!Array.isArray(raw.boards) || !Array.isArray(raw.joints) || !Array.isArray(raw.woods)) invalid('boards, joints or woods are missing')
  const woodIds = new Set<string>()
  for (const w of raw.woods) {
    if (!isObj(w) || typeof w.id !== 'string' || !isNum(w.thickness) || !isNum(w.width) || !isNum(w.length)) invalid('a wood entry is damaged')
    woodIds.add(w.id)
  }
  const boardIds = new Set<string>()
  for (const b of raw.boards) {
    if (!isObj(b) || typeof b.id !== 'string') invalid('a board is damaged')
    const name = typeof b.name === 'string' ? b.name : b.id
    for (const k of ['thickness', 'width', 'length']) if (!isNum(b[k]) || b[k] <= 0) invalid(`board "${name}" has no valid ${k}`)
    if (!isVec(b.position) || !isVec(b.rotation)) invalid(`board "${name}" has no valid position`)
    if (!isObj(b.endCuts) || !isEnd(b.endCuts.start) || !isEnd(b.endCuts.end)) invalid(`board "${name}" has damaged end cuts`)
    if (!isObj(b.edgeBevels) || !isNum(b.edgeBevels.left) || !isNum(b.edgeBevels.right)) invalid(`board "${name}" has damaged edge bevels`)
    if (!Array.isArray(b.holes) || !b.holes.every((h: any) => isObj(h) && isNum(h.diameter) && h.diameter > 0 && isNum(h.u) && isNum(h.v))) {
      invalid(`board "${name}" has damaged holes`)
    }
    if (b.grain !== 'length' && b.grain !== 'width') invalid(`board "${name}" has an unknown grain direction`)
    if (!woodIds.has(b.woodId)) invalid(`board "${name}" uses a wood that isn't in the file`)
    boardIds.add(b.id)
  }
  const sketches = new Map<string, Set<string>>()
  if (raw.sketches !== undefined) {
    if (!Array.isArray(raw.sketches)) invalid('the drawings are damaged')
    for (const s of raw.sketches) {
      checkSketch(s)
      sketches.set(s.id, new Set(s.entities.map((e: { id: string }) => e.id)))
    }
  }
  for (const b of raw.boards) {
    if (b.outline === undefined) continue
    const o = b.outline
    const list = (v: unknown) => Array.isArray(v) && v.every(isStr)
    if (!isObj(o) || !isStr(o.sketchId) || !list(o.outer) || !Array.isArray(o.holes) || !o.holes.every(list) || !list(o.circles) || (o.turn !== undefined && o.turn !== 0 && o.turn !== 90)) {
      invalid(`board "${b.name}" has a damaged shape`)
    }
    // A shaped part whose drawing is gone is simply a rectangle again (its size is its bounding rectangle).
    // One whose drawing no longer makes a closed shape keeps its link and shows as a rectangle until it does.
    if (!sketches.has(o.sketchId)) delete b.outline
  }
  const pos = (v: unknown) => isNum(v) && v >= 0
  for (const b of raw.boards) {
    if (b.turning !== undefined) {
      const t = b.turning
      if (!isObj(t) || !isStr(t.sketchId) || !oneOf(t.style, TURN_STYLES) || !pos(t.top) || !pos(t.bottom) || !oneOf(t.shoulder, ['crisp', 'lambsTongue']) ||
        (t.maxD !== undefined && !(isNum(t.maxD) && t.maxD > 0)) || (t.minD !== undefined && !(isNum(t.minD) && t.minD > 0))) {
        invalid(`board "${b.name}" has a damaged turning`)
      }
      // A turning whose drawing is gone is just its square blank again.
      if (!sketches.has(t.sketchId)) delete b.turning
    }
    if (b.taper !== undefined) {
      const t = b.taper
      if (!isObj(t) || !Array.isArray(t.faces) || !t.faces.every((f: unknown) => oneOf(f, FACES)) || !pos(t.start) || !isNum(t.foot) || t.foot <= 0) {
        invalid(`board "${b.name}" has a damaged taper`)
      }
    }
    if (b.edges !== undefined) {
      if (!Array.isArray(b.edges)) invalid(`board "${b.name}" has damaged edge profiles`)
      for (const e of b.edges) {
        if (!isObj(e) || !isStr(e.id) || !oneOf(e.profile, PROFILE_KINDS) || !isNum(e.size) || e.size <= 0 || !oneOf(e.face, ['top', 'bottom']) ||
          !Array.isArray(e.sides) || !e.sides.every((x: unknown) => oneOf(x, EDGE_SIDES))) {
          invalid(`board "${b.name}" has a damaged edge profile`)
        }
      }
    }
  }
  // Sizes, formulas and rules: checked for shape only. A name or part that is missing is shown as a formula error, not refused.
  const formulasOk = (f: unknown) => f === undefined || (isObj(f) && Object.values(f).every(isStr))
  if (raw.sizes !== undefined) {
    if (!Array.isArray(raw.sizes) || !raw.sizes.every((s: any) => isObj(s) && isStr(s.name) && isStr(s.expr))) invalid('the named sizes are damaged')
  }
  for (const b of raw.boards) if (!formulasOk(b.formulas)) invalid(`board "${b.name}" has damaged formulas`)
  for (const j of raw.joints) if (isObj(j) && !formulasOk(j.formulas)) invalid('a joint has damaged formulas')
  if (raw.rules !== undefined) {
    const ax = (v: unknown) => oneOf(v, AXES3)
    const ids = (v: unknown) => Array.isArray(v) && v.every(isStr)
    const ruleOk = (r: any) => isObj(r) && isStr(r.id) && (
      r.kind === 'spacing' ? ax(r.axis) && isStr(r.from) && isStr(r.to) && ids(r.parts)
        : r.kind === 'center' ? Array.isArray(r.axes) && r.axes.every(ax) && isStr(r.part) && isStr(r.on)
          : r.kind === 'gap' ? ax(r.axis) && isStr(r.part) && isStr(r.to) && oneOf(r.side, ['min', 'max']) && isNum(r.gap) && (r.gapExpr === undefined || isStr(r.gapExpr))
            : r.kind === 'count' ? isStr(r.expr) && isStr(r.first) && ids(r.copies) && ax(r.axis) && isStr(r.from) && isStr(r.to)
              : false)
    if (!Array.isArray(raw.rules) || !raw.rules.every(ruleOk)) invalid('a layout rule is damaged')
  }
  for (const j of raw.joints) {
    if (!isObj(j) || typeof j.type !== 'string' || !isObj(j.params)) invalid('a joint is damaged')
    if (!jointParamsOk(j.type, j.params)) invalid(`a ${j.type} joint has damaged settings`)
    if (!boardIds.has(j.hostBoardId) || !boardIds.has(j.partnerBoardId)) invalid('a joint refers to a board that is missing')
  }
  // Groups: shape is checked; references that point nowhere are cleaned up (the parts stay).
  if (raw.groups !== undefined) {
    if (!Array.isArray(raw.groups) || !raw.groups.every((g: any) => isObj(g) && isStr(g.id) && isStr(g.name) && (g.parentId === undefined || isStr(g.parentId)) && (g.link === undefined || isStr(g.link)))) {
      invalid('a group is damaged')
    }
  }
  for (const b of raw.boards) {
    if ((b.groupId !== undefined && !isStr(b.groupId)) || (b.link !== undefined && !isStr(b.link))) invalid(`board "${b.name}" has a damaged group`)
  }
  if (raw.annotations !== undefined) {
    const ok = (a: any) => isObj(a) && isStr(a.id) && (
      a.kind === 'dimension' ? isVec(a.a) && isVec(a.b) && (a.label === undefined || isStr(a.label))
        : a.kind === 'note' ? isVec(a.at) && isStr(a.text) && a.text.trim() !== '' : false)
    if (!Array.isArray(raw.annotations) || !raw.annotations.every(ok)) invalid('a dimension or note is damaged')
    // A repeated id (a hand-edited file) keeps the first.
    const seen = new Set<string>()
    raw.annotations = raw.annotations.filter((a: { id: string }) => (seen.has(a.id) ? false : (seen.add(a.id), true)))
  }
  return pruneGroups(raw as Project)
}

export function deserialize(text: string): Project {
  let raw: any
  try {
    raw = JSON.parse(text)
  } catch {
    throw new ProjectFileError('corrupt', 'This project file is damaged and can\'t be read.')
  }
  if (isObj(raw) && isNum(raw.formatVersion) && raw.formatVersion > FORMAT_VERSION) {
    throw new ProjectFileError('newerVersion', 'This project was made with a newer version of A&A Woodworking Studio.')
  }
  if (!isObj(raw) || !isNum(raw.formatVersion)) invalid('it has no format version')
  return check(migrate(raw))
}
