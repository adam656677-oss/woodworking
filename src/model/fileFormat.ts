// .aaw project files: versioned JSON with structural checks, so a damaged file gives a plain message, not a crash.
import type { Project } from './types'

export const FORMAT_VERSION = 1

export class ProjectFileError extends Error {
  constructor(public code: 'corrupt' | 'newerVersion' | 'invalid', message: string) {
    super(message)
    this.name = 'ProjectFileError'
  }
}

type Migration = (raw: any) => any
/** Step-by-step upgrades: MIGRATIONS[n] turns a version-n object into version n+1. */
const MIGRATIONS: Record<number, Migration> = {}

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
    if (!Array.isArray(b.holes)) invalid(`board "${name}" has damaged holes`)
    if (!woodIds.has(b.woodId)) invalid(`board "${name}" uses a wood that isn't in the file`)
    boardIds.add(b.id)
  }
  for (const j of raw.joints) {
    if (!isObj(j) || typeof j.type !== 'string' || !isObj(j.params)) invalid('a joint is damaged')
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
