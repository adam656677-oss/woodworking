// Router edge profiles: their cross-sections, size checks, cut-list notes and the cuts they make.
import { newId } from '../model/ids'
import type { OpError } from '../model/ops'
import type { Board, Project } from '../model/types'
import { formatInches } from '../model/units'
import type { Pt } from '../sketch/types'
import type { EdgeProfile, EdgeSide, ProfileKind } from './types'

export const KID_PROFILES: ProfileKind[] = ['roundover', 'chamfer']
export const KID_SIZES = [1 / 8, 1 / 4]
export const SIZES = [1 / 8, 1 / 4, 3 / 8, 1 / 2]
export const STRAIGHT_SIDES: Exclude<EdgeSide, 'outline'>[] = ['left', 'right', 'start', 'end']
export const PROFILE_NAMES: Record<ProfileKind, string> = { roundover: 'roundover', chamfer: 'chamfer', cove: 'cove', ogee: 'ogee' }
export const MSG_TURNED_EDGE = "Profiles can't go on a turned section"
export const msgTooBig = (size: number, kind: ProfileKind) => `A ${formatInches(size)} ${PROFILE_NAMES[kind]} is too big for this board`

const arc = (cx: number, cy: number, r: number, a0: number, a1: number, n = 16): Pt[] =>
  Array.from({ length: n + 1 }, (_, i) => { const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180; return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) } })

/**
 * The wood a profile removes, in edge coordinates: x across the face from the edge, y down from the face.
 * (0, 0) is the board's corner.
 */
export function profileSection(kind: ProfileKind, s: number): Pt[] {
  switch (kind) {
    case 'chamfer': return [{ x: 0, y: 0 }, { x: s, y: 0 }, { x: 0, y: s }]
    case 'roundover': return [{ x: 0, y: 0 }, ...arc(s, s, s, 270, 180)]
    case 'cove': return [{ x: 0, y: 0 }, ...arc(0, 0, s, 0, 90)]
    case 'ogee': return [{ x: 0, y: 0 }, ...arc(s / 2, 0, s / 2, 0, 90), ...arc(s / 2, s, s / 2, 270, 180).slice(1)]
  }
}

const sideLength = (b: Board, side: EdgeSide) => (side === 'left' || side === 'right' ? b.length : b.width)

/** Why these profiles can't be cut on this board, or null (the newest is named first: it's the one just asked for). */
export function edgeProblem(b: Board, list: EdgeProfile[]): string | null {
  for (const e of [...list].reverse()) {
    const p = edgeProblemFor(b, list, e)
    if (p) return p
  }
  return null
}

/** Why this one profile can't be cut (alone, or with the others on the same edge), or null. */
export function edgeProblemFor(b: Board, list: EdgeProfile[], e: EdgeProfile): string | null {
  {
    if (b.turning && e.sides.some(s => s === 'left' || s === 'right')) return MSG_TURNED_EDGE
    if (!e.sides.length) return 'Pick the edges to shape'
    if (e.sides.includes('outline') !== !!b.outline) return b.outline ? 'A shaped part is profiled around its outline' : 'Pick the edges to shape'
    if (e.size > b.thickness + 1e-9 || e.size > b.width / 2 + 1e-9) return msgTooBig(e.size, e.profile)
    // Top and bottom profiles on one edge must leave wood between them.
    for (const o of list) {
      if (o === e || o.face === e.face) continue
      if (o.sides.some(s => e.sides.includes(s)) && o.size + e.size > b.thickness + 1e-9) return msgTooBig(e.size, e.profile)
    }
  }
  return null
}

export function addEdgeProfile(p: Project, id: string, e: Omit<EdgeProfile, 'id'>): Project | OpError {
  const b = p.boards.find(x => x.id === id)
  if (!b) return { error: 'That part is missing' }
  const next: EdgeProfile = { ...e, sides: (['left', 'right', 'start', 'end', 'outline'] as EdgeSide[]).filter(s => e.sides.includes(s)), id: newId('p') }
  const list = [...(b.edges ?? []), next]
  const problem = edgeProblemFor(b, list, next)
  if (problem) return { error: problem }
  return { ...p, boards: p.boards.map(x => (x.id === id ? { ...x, edges: list } : x)) }
}

export function removeEdgeProfile(p: Project, id: string, edgeId: string): Project {
  return { ...p, boards: p.boards.map(x => {
    if (x.id !== id || !x.edges) return x
    const edges = x.edges.filter(e => e.id !== edgeId)
    if (edges.length) return { ...x, edges }
    const { edges: _e, ...rest } = x
    return rest as Board
  }) }
}

/** Cut-list notes: `1/4" roundover — top edges (all 4)`, `1/4" chamfer — top: left, right`. */
export function edgeNotes(b: Board): string[] {
  const list = b.edges ?? []
  return list.filter(e => !edgeProblemFor(b, list, e)).map(edgeNote)
}

export function edgeNote(e: EdgeProfile): string {
  {
    const what = `${formatInches(e.size)} ${PROFILE_NAMES[e.profile]}`
    if (e.sides.includes('outline')) return `${what} — ${e.face} outline`
    if (STRAIGHT_SIDES.every(s => e.sides.includes(s))) return `${what} — ${e.face} edges (all 4)`
    return `${what} — ${e.face}: ${e.sides.join(', ')}`
  }
}

/** The profiles without their ids: what makes two parts the same in the shop. */
export const edgeSignature = (b: Board) => (b.edges ?? []).map(({ id: _i, ...rest }) => rest)

/** Wood a profile removes along one straight edge (board coordinates via `toEdge`). */
export type ProfileCut = { boardId: string; kind: 'profile'; face: 'top' | 'bottom'; side: Exclude<EdgeSide, 'outline'>; section: Pt[]; length: number }

export function profileCuts(b: Board): ProfileCut[] {
  const list = b.edges ?? []
  return list.filter(e => !edgeProblemFor(b, list, e)).flatMap(e => e.sides.filter((s): s is ProfileCut['side'] => s !== 'outline')
    .map(side => ({ boardId: b.id, kind: 'profile' as const, face: e.face, side, section: profileSection(e.profile, e.size), length: sideLength(b, side) })))
}

/** A board point in a profile cut's edge coordinates: u across the face from the edge, v down from the face. */
export function toEdge(b: Board, c: Pick<ProfileCut, 'face' | 'side'>, p: { x: number; y: number; z: number }): { u: number; v: number } {
  const v = c.face === 'top' ? b.thickness - p.z : p.z
  const u = c.side === 'left' ? p.x : c.side === 'right' ? b.width - p.x : c.side === 'start' ? p.y : b.length - p.y
  return { u, v }
}

export function inSection(section: Pt[], u: number, v: number): boolean {
  let inside = false
  for (let i = 0, j = section.length - 1; i < section.length; j = i++) {
    const a = section[i], c = section[j]
    if ((a.y > v) !== (c.y > v) && u < ((c.x - a.x) * (v - a.y)) / (c.y - a.y) + a.x) inside = !inside
  }
  return inside
}
