// Tapered legs and parts: how much comes off each face, the jig numbers, the cutting order and the plane cuts.
import { AXES, overlap1, rotateVec, worldBox, type Box } from '../model/geometry'
import type { PlaneCut } from '../model/joints'
import type { OpError } from '../model/ops'
import type { Board, Project } from '../model/types'
import { formatInches, snap64 } from '../model/units'
import { topEnd } from './turning'
import type { Face, Taper } from './types'

export const MSG_FOOT_BIG = "The foot can't be bigger than the leg"
export const MSG_START = "The taper can't start below the foot"
export const MSG_FOOT_SMALL = 'The foot must be at least 1/4"'
export const MSG_TURNED = 'A turned leg is shaped by its profile'
export const MSG_NO_FACE = 'Pick at least one face to taper'

const axisOf = (f: Face): 'width' | 'thickness' => (f === 'left' || f === 'right' ? 'width' : 'thickness')
const sizeOn = (b: Board, f: Face) => (axisOf(f) === 'width' ? b.width : b.thickness)

export const FACE_NAMES: Record<Face, string> = { left: 'left side', right: 'right side', top: 'top face', bottom: 'bottom face' }

export const taperLength = (b: Board, t: Taper) => b.length - t.start

/** Inches taken off each chosen face at the foot. Two faces on the same axis share the reduction. */
export function removedPerFace(b: Board, t: Taper): Record<Face, number> {
  const out: Record<Face, number> = { left: 0, right: 0, top: 0, bottom: 0 }
  for (const f of t.faces) {
    const same = t.faces.filter(g => axisOf(g) === axisOf(f)).length
    out[f] = (sizeOn(b, f) - t.foot) / same
  }
  return out
}

/** The angle of the taper on a face (degrees from the face). */
export const taperAngle = (b: Board, t: Taper, f: Face = t.faces[0]) => (Math.atan(removedPerFace(b, t)[f] / taperLength(b, t)) * 180) / Math.PI
/** Taper-jig opening measured 12" from the jig's hinge. */
export const jigAt12 = (b: Board, t: Taper, f: Face = t.faces[0]) => (12 * removedPerFace(b, t)[f]) / taperLength(b, t)

export function taperProblem(b: Board, t: Taper): string | null {
  if (b.turning) return MSG_TURNED
  if (!t.faces.length) return MSG_NO_FACE
  if (t.foot < 0.25 - 1e-9) return MSG_FOOT_SMALL
  if (t.faces.some(f => t.foot > sizeOn(b, f) + 1e-9)) return MSG_FOOT_BIG
  if (t.start < 0 || t.start >= b.length - 1e-9) return MSG_START
  return null
}

export function taperBoard(p: Project, id: string, t: Taper): Project | OpError {
  const b = p.boards.find(x => x.id === id)
  if (!b) return { error: 'That part is missing' }
  const clean: Taper = { faces: [...new Set(t.faces)], start: snap64(t.start), foot: snap64(t.foot) }
  const problem = taperProblem(b, clean)
  if (problem) return { error: problem }
  return { ...p, boards: p.boards.map(x => (x.id === id ? { ...x, taper: clean } : x)) }
}

export function untaperBoard(p: Project, id: string): Project {
  return { ...p, boards: p.boards.map(x => {
    if (x.id !== id || !x.taper) return x
    const { taper: _t, ...rest } = x
    return rest as Board
  }) }
}

export function TAPER_NOTE(b: Board, t: Taper): string {
  const n = t.faces.length
  return `Taper ${n} face${n === 1 ? '' : 's'}: ${formatInches(sizeOn(b, t.faces[0]))} → ${formatInches(t.foot)} over ${formatInches(taperLength(b, t))}, starting ${formatInches(t.start)} from the top`
}

/** The order to make the cuts so the leg always sits flat on the jig. */
export function cuttingOrder(t: Taper): string[] {
  const [a, b] = t.faces
  if (t.faces.length === 1) return [`Cut the ${FACE_NAMES[a]}.`]
  if (t.faces.length === 2 && axisOf(a) !== axisOf(b)) {
    return [`Cut the ${FACE_NAMES[a]}.`, `Turn the leg a quarter turn so the cut face is up, then cut the ${FACE_NAMES[b]}.`]
  }
  if (t.faces.length === 2) return [`Cut the ${FACE_NAMES[a]}.`, 'Tape the offcut back on so the leg sits flat, turn it over, and cut the opposite face.']
  if (t.faces.length === 4) return ['Cut two opposite faces.', 'Tape the offcuts back on so the leg sits flat.', 'Cut the other two faces.']
  return t.faces.map((f, i) => (i === 0 ? `Cut the ${FACE_NAMES[f]}.` : `Tape the last offcut back on, turn the leg, and cut the ${FACE_NAMES[f]}.`))
}

const OUTWARD: Record<Face, { x: number; y: number; z: number }> = { left: { x: -1, y: 0, z: 0 }, right: { x: 1, y: 0, z: 0 }, top: { x: 0, y: 0, z: 1 }, bottom: { x: 0, y: 0, z: -1 } }

/** The material each tapered face loses, as plane cuts in the board's own coordinates. */
export function taperCuts(b: Board): PlaneCut[] {
  const t = b.taper
  if (!t || b.turning || taperProblem(b, t)) return []
  const removed = removedPerFace(b, t)
  const fromStart = topEnd(b) === 'start'
  const ys = fromStart ? t.start : b.length - t.start
  const along = fromStart ? 1 : -1
  return t.faces.map(f => {
    const k = removed[f] / taperLength(b, t)
    const n0 = OUTWARD[f]
    const point = { x: f === 'right' ? b.width : 0, y: ys, z: f === 'top' ? b.thickness : 0 }
    return { boardId: b.id, kind: 'taper' as const, plane: { point, normal: { x: n0.x, y: k * along, z: n0.z } } }
  })
}

/** A face's outward direction in the world. */
export const faceNormalWorld = (b: Board, f: Face) => rotateVec(OUTWARD[f], b.rotation)

/** For two inside faces: one side and one face, each the one looking toward the middle of the design. */
export function insideFaces(p: Project, b: Board): Face[] {
  const boxes = p.boards.map(worldBox)
  const c = {
    x: (Math.min(...boxes.map(x => x.min.x)) + Math.max(...boxes.map(x => x.max.x))) / 2,
    y: (Math.min(...boxes.map(x => x.min.y)) + Math.max(...boxes.map(x => x.max.y))) / 2
  }
  const me = worldBox(b)
  const to = { x: c.x - (me.min.x + me.max.x) / 2, y: c.y - (me.min.y + me.max.y) / 2 }
  const score = (f: Face) => { const n = faceNormalWorld(b, f); return n.x * to.x + n.y * to.y }
  const pick = (u: Face, v: Face) => (score(u) >= score(v) ? u : v)
  return [pick('left', 'right'), pick('top', 'bottom')]
}

/** Two boxes meet: touching (or overlapping) on every axis, with real area on at least two. */
function touching(a: Box, c: Box): boolean {
  const ov = AXES.map(ax => overlap1(a.min[ax], a.max[ax], c.min[ax], c.max[ax]))
  return ov.every(o => o >= -1 / 64) && ov.filter(o => o > 1e-6).length >= 2
}

/** Where a taper usually starts: 1/2" below the lowest part joined to or touching an upright leg; else 5". */
export function defaultStart(p: Project, b: Board): number {
  const me = worldBox(b)
  const upright = me.max.z - me.min.z >= b.length - 1e-6
  const fallback = Math.min(5, b.length / 3)
  if (!upright) return fallback
  const others = p.boards.filter(o => o.id !== b.id && (touching(me, worldBox(o)) || p.joints.some(j =>
    (j.hostBoardId === b.id && j.partnerBoardId === o.id) || (j.partnerBoardId === b.id && j.hostBoardId === o.id))))
  const lows = others.map(o => worldBox(o).min.z).filter(z => z > me.min.z + 1e-6 && z < me.max.z)
  if (!lows.length) return fallback
  return snap64(Math.min(me.max.z - Math.min(...lows) + 0.5, b.length - 1))
}

