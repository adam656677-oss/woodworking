// Square-to-round turned legs: the profile drawing, its checks, the caliper stations and the cut-list note.
import { localAxes } from '../model/geometry'
import { newId } from '../model/ids'
import type { OpError } from '../model/ops'
import { addSketch, sketchOf } from '../model/shaped'
import type { Board, Project } from '../model/types'
import { formatInches, snap64 } from '../model/units'
import { endsOf, findLoops, tessellateEntity } from '../sketch/geometry'
import { newSketch, type Sketch, type SketchEntity } from '../sketch/types'
import type { Turning, TurnStyle } from './types'

export const MSG_SQUARE = 'Turning needs a square blank — like a 2x2 or a 1-3/4" × 1-3/4" glued-up blank.'
export const MSG_GAPS = 'The profile must run from the pommel to the foot without gaps'
export const msgWider = (blank: number) => `The turning is wider than the blank (max ${formatInches(blank)})`
export const MSG_TAPERED = 'This leg is tapered — remove the taper first'

const TOL = 1 / 64

/** Which end of the board is its top: the higher end when it stands upright, else the start (y = 0) end. */
export function topEnd(b: Board): 'start' | 'end' {
  const l = localAxes(b).length
  return l.axis === 'z' && l.sign > 0 ? 'end' : 'start'
}

export const isSquareBlank = (b: Board) => Math.abs(b.width - b.thickness) <= TOL

/** The blank's side: the turning's largest possible diameter. */
export const blankOf = (b: Board) => Math.min(b.width, b.thickness)

export type StyleOptions = {
  style: Exclude<TurnStyle, 'custom'>
  length: number
  blank: number
  top: number
  bottom: number
  shoulder: Turning['shoulder']
  maxD: number
  minD: number
}

/** Each style's shape: (fraction along the turned part, radius as a fraction of the biggest/smallest radius). */
function keyPoints(style: StyleOptions['style'], R: number, r: number): [number, number][] {
  switch (style) {
    case 'taper': return [[0, R], [1, r]]
    case 'beadCove': return [[0, R], [0.04, 0.8 * R], [0.08, 0.98 * R], [0.13, 0.7 * R], [0.2, 0.95 * R], [0.6, (R + r) / 2 + 0.05 * R], [1, r]]
    case 'vase': return [[0, 0.9 * R], [0.07, 0.62 * R], [0.3, 0.98 * R], [0.65, Math.max(r, 0.66 * R)], [1, r]]
    case 'ballFoot': return [[0, R], [0.78, Math.max(r, 0.55 * R)], [0.84, Math.max(r * 0.9, 0.5 * R)], [0.92, 0.9 * R], [1, Math.max(0.45 * R, r * 0.8)]]
  }
}

/** A ready-made profile as a drawing: x = distance from the top end, y = radius. Guide lines show the centre and the blank. */
export function styleProfile(o: StyleOptions, id: string, name: string): Sketch {
  const s = newSketch(id, name, 'precise')
  const B = o.blank / 2
  const R = Math.min(o.maxD / 2, B), r = Math.min(o.minD / 2, R)
  const a = o.top, b = o.length - o.bottom
  const P = (pid: string, x: number, y: number) => { s.points.push({ id: pid, x: snap64(x), y }); return pid }
  // Guides.
  P('g1', 0, 0); P('g2', o.length, 0); P('g3', 0, B); P('g4', o.length, B)
  s.entities.push({ id: 'centre', kind: 'line', a: 'g1', b: 'g2', construction: true }, { id: 'blank', kind: 'line', a: 'g3', b: 'g4', construction: true })
  const key = keyPoints(o.style, R, r)
  const ids: string[] = []
  let start = a
  if (o.shoulder === 'lambsTongue') start = a + Math.min(0.75, (b - a) / 6)
  key.forEach(([f, y], i) => ids.push(P(`k${i}`, start + f * (b - start), y)))
  if (o.shoulder === 'lambsTongue') {
    // A short curve of its own from the flats of the square down to the round.
    P('q0', a, B)
    P('q1', (a + start) / 2, (B + key[0][1]) / 2 + 0.15 * (B - key[0][1]))
    s.entities.push({ id: 'tongue', kind: 'spline', points: ['q0', 'q1', ids[0]] })
  }
  if (ids.length === 2) s.entities.push({ id: 'profile', kind: 'line', a: ids[0], b: ids[1] })
  else s.entities.push({ id: 'profile', kind: 'spline', points: ids })
  return s
}

const live = (e: SketchEntity) => e.kind !== 'text' && !('construction' in e && e.construction)

/** The profile as radii along the leg (every 1/32"), or null when it isn't one unbroken run from pommel to foot. */
export function profileRadii(p: Project, b: Board): { x: number; r: number }[] | null {
  const t = b.turning
  if (!t) return null
  const sk = sketchOf(p, t.sketchId)
  if (!sk) return null
  return radiiOf(sk, b.length, t)
}

export function radiiOf(sk: Sketch, length: number, t: Pick<Turning, 'top' | 'bottom'>): { x: number; r: number }[] | null {
  try {
    const ents = sk.entities.filter(live)
    if (!ents.length || ents.some(e => !endsOf(sk, e))) return null
    const sub = { ...sk, entities: ents }
    const { closed, gaps, junctions } = findLoops(sub)
    // One open run: exactly two loose ends, nothing branching, nothing closed.
    if (closed.length || junctions.length || gaps.length !== 2) return null
    const pts = ents.flatMap(e => tessellateEntity(sk, e, 1 / 32))
    pts.sort((u, v) => u.x - v.x)
    const a = t.top, z = length - t.bottom
    if (Math.abs(pts[0].x - a) > TOL || Math.abs(pts[pts.length - 1].x - z) > TOL) return null
    if (pts.some(q => !(q.y > 0))) return null
    // It must run one way along the leg (a lathe can't turn a profile that doubles back).
    const total = ents.reduce((s, e) => { const [u, v] = endsOf(sk, e)!; return s + Math.abs(v.x - u.x) }, 0)
    if (total > z - a + TOL) return null
    const out: { x: number; r: number }[] = []
    for (const q of pts) if (!out.length || q.x - out[out.length - 1].x > 1e-6) out.push({ x: q.x, r: q.y })
    return out
  } catch {
    return null
  }
}

/** What's wrong with a board's turning, or null. */
export function turningProblem(p: Project, b: Board): string | null {
  if (!b.turning) return null
  if (!isSquareBlank(b)) return MSG_SQUARE
  const radii = profileRadii(p, b)
  if (!radii) return MSG_GAPS
  if (Math.max(...radii.map(q => q.r)) > blankOf(b) / 2 + 1e-6) return msgWider(blankOf(b))
  return null
}

/** Where to set the calipers: every point on the profile, plus every 2" from the top; diameters to 1/32". */
export function stations(p: Project, b: Board): { at: number; diameter: number }[] {
  const radii = profileRadii(p, b)
  const t = b.turning
  if (!radii || !t) return []
  const sk = sketchOf(p, t.sketchId)!
  const marks = new Set<number>()
  for (const e of sk.entities.filter(live)) {
    const ids = e.kind === 'line' ? [e.a, e.b] : e.kind === 'arc' ? [e.start, e.end] : e.kind === 'spline' ? e.points : []
    for (const id of ids) marks.add(snap64(sk.points.find(q => q.id === id)!.x))
  }
  const a = radii[0].x, z = radii[radii.length - 1].x
  for (let x = Math.ceil(a / 2) * 2; x < z; x += 2) marks.add(x)
  const at = (x: number) => {
    let i = radii.findIndex(q => q.x >= x)
    if (i <= 0) return radii[Math.max(0, i)].r
    const u = radii[i - 1], v = radii[i]
    return u.r + ((v.r - u.r) * (x - u.x)) / (v.x - u.x || 1)
  }
  return [...marks].filter(x => x >= a - 1e-9 && x <= z + 1e-9).sort((u, v) => u - v).map(x => ({ at: x, diameter: Math.round(at(x) * 2 * 32) / 32 }))
}

export function TURN_NOTE(t: Turning): string {
  return `Turned — ${formatInches(t.top)} pommel${t.bottom > 0 ? `, ${formatInches(t.bottom)} foot` : ''} (see turning sheet)`
}

export type TurnOptions = { style: Exclude<TurnStyle, 'custom'>; top?: number; bottom?: number; shoulder?: Turning['shoulder']; maxD?: number; minD?: number }

/** Turns a square leg to a ready-made style (its profile becomes a drawing you can edit). */
export function turnBoard(p: Project, boardId: string, o: TurnOptions): { project: Project; sketchId: string } | OpError {
  const b = p.boards.find(x => x.id === boardId)
  if (!b) return { error: 'That part is missing' }
  if (!isSquareBlank(b)) return { error: MSG_SQUARE }
  if (b.taper) return { error: MSG_TAPERED }
  const blank = blankOf(b)
  const top = o.top ?? b.turning?.top ?? Math.min(5, b.length / 4)
  const bottom = o.bottom ?? b.turning?.bottom ?? 0
  const shoulder = o.shoulder ?? b.turning?.shoulder ?? 'crisp'
  const maxD = o.maxD ?? blank - 1 / 16
  const minD = o.minD ?? Math.max(0.25, snap64(blank * 0.4))
  if (maxD > blank + 1e-9) return { error: msgWider(blank) }
  if (!(minD > 0) || minD > maxD) return { error: 'The smallest diameter must be more than 0 and no bigger than the biggest' }
  if (top < 0 || bottom < 0 || top + bottom > b.length - 2) return { error: 'Leave at least 2" between the pommel and the foot to turn' }
  const sketchId = b.turning?.sketchId ?? newId('k')
  const sk = styleProfile({ style: o.style, length: b.length, blank, top, bottom, shoulder, maxD, minD }, sketchId, `${b.name} profile`)
  const others = (p.sketches ?? []).filter(s => s.id !== sketchId)
  const turning: Turning = { sketchId, style: o.style, top: snap64(top), bottom: snap64(bottom), shoulder }
  const withSketch = { ...p, sketches: others }
  const project = addSketch({ ...withSketch, boards: p.boards.map(x => (x.id === boardId || x.turning?.sketchId === sketchId ? { ...x, turning: { ...turning } } : x)) }, sk)
  return { project, sketchId }
}

/** Back to a square blank; the profile drawing goes too unless another leg shares it. */
export function unturnBoard(p: Project, boardId: string): Project {
  const b = p.boards.find(x => x.id === boardId)
  if (!b?.turning) return p
  const sid = b.turning.sketchId
  const boards: Board[] = p.boards.map(x => {
    if (x.id !== boardId) return x
    const { turning: _t, ...rest } = x
    return rest
  })
  const shared = boards.some(x => x.turning?.sketchId === sid || x.outline?.sketchId === sid)
  return { ...p, boards, sketches: shared ? p.sketches : (p.sketches ?? []).filter(s => s.id !== sid) }
}
