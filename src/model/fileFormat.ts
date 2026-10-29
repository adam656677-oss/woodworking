// .aaw project files: versioned JSON with structural checks, so a damaged file gives a plain message, not a crash.
import { CONSTRAINT_KINDS } from '../sketch/types'
import type { Project } from './types'

export const FORMAT_VERSION = 2

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
  1: raw => ({ ...raw, formatVersion: 2, sketches: [] })
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
    const ents = isObj(o) && isStr(o.sketchId) ? sketches.get(o.sketchId) : undefined
    const list = (v: unknown) => Array.isArray(v) && v.every(x => isStr(x) && ents!.has(x))
    if (!ents || !list(o.outer) || !Array.isArray(o.holes) || !o.holes.every(list) || !list(o.circles)) {
      invalid(`board "${b.name}" is shaped from a drawing that is missing or damaged`)
    }
  }
  for (const j of raw.joints) {
    if (!isObj(j) || typeof j.type !== 'string' || !isObj(j.params)) invalid('a joint is damaged')
    if (!jointParamsOk(j.type, j.params)) invalid(`a ${j.type} joint has damaged settings`)
    if (!boardIds.has(j.hostBoardId) || !boardIds.has(j.partnerBoardId)) invalid('a joint refers to a board that is missing')
  }
  return raw as Project
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
