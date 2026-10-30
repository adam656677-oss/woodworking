// What each joint and angled cut removes from a board, whether it is valid, and the shop notes it produces.
import type { Board, ButtParams, GrooveParams, Joint, MiterParams, PocketParams, Project, Vec3 } from './types'
import { formatInches } from './units'
import { taperCuts } from '../shaping/taper'
import { inSection, profileCuts, toEdge, type ProfileCut } from '../shaping/edges'

export type BoxCut = { boardId: string; kind: 'dado' | 'rabbet'; min: Vec3; max: Vec3 }
export type HoleCut = { boardId: string; kind: 'hole'; center: Vec3; diameter: number; depth: number }
/** Material on the `normal` side of the plane through `point` is removed (board-local coordinates). */
export type PlaneCut = { boardId: string; kind: 'miter' | 'bevel' | 'taper'; plane: { point: Vec3; normal: Vec3 } }
export type Cut = BoxCut | HoleCut | PlaneCut | ProfileCut

export const MAX_ANGLE = 60
const EPS = 1e-9

const rad = (deg: number) => (deg * Math.PI) / 180

function boardById(project: Project, id: string): Board | undefined {
  return project.boards.find(b => b.id === id)
}

function isGroove(j: Joint): j is Joint & { params: GrooveParams } {
  return j.type === 'dado' || j.type === 'rabbet'
}

function grooveBox(host: Board, p: GrooveParams): { min: Vec3; max: Vec3 } {
  if (p.face === 'left' || p.face === 'right') {
    const x0 = p.face === 'left' ? 0 : host.width - p.depth
    return { min: { x: x0, y: 0, z: p.offset }, max: { x: x0 + p.depth, y: host.length, z: p.offset + p.width } }
  }
  const z0 = p.face === 'top' ? host.thickness - p.depth : 0
  const z1 = p.face === 'top' ? host.thickness : p.depth
  if ((p.along ?? 'width') === 'width') {
    return { min: { x: 0, y: p.offset, z: z0 }, max: { x: host.width, y: p.offset + p.width, z: z1 } }
  }
  return { min: { x: p.offset, y: 0, z: z0 }, max: { x: p.offset + p.width, y: host.length, z: z1 } }
}

function endAndEdgeCuts(b: Board): PlaneCut[] {
  const cuts: PlaneCut[] = []
  const { width: W, length: L, thickness: T } = b
  const s = b.endCuts.start
  const e = b.endCuts.end
  if (s.miter) {
    const t = Math.tan(rad(s.miter))
    cuts.push({ boardId: b.id, kind: 'miter', plane: { point: { x: s.miter > 0 ? 0 : W, y: 0, z: 0 }, normal: { x: t, y: -1, z: 0 } } })
  }
  if (e.miter) {
    const t = Math.tan(rad(e.miter))
    cuts.push({ boardId: b.id, kind: 'miter', plane: { point: { x: e.miter > 0 ? 0 : W, y: L, z: 0 }, normal: { x: t, y: 1, z: 0 } } })
  }
  if (s.bevel) {
    const t = Math.tan(rad(s.bevel))
    cuts.push({ boardId: b.id, kind: 'bevel', plane: { point: { x: 0, y: 0, z: s.bevel > 0 ? 0 : T }, normal: { x: 0, y: -1, z: t } } })
  }
  if (e.bevel) {
    const t = Math.tan(rad(e.bevel))
    cuts.push({ boardId: b.id, kind: 'bevel', plane: { point: { x: 0, y: L, z: e.bevel > 0 ? 0 : T }, normal: { x: 0, y: 1, z: t } } })
  }
  const { left, right } = b.edgeBevels
  if (left) {
    const t = Math.tan(rad(left))
    cuts.push({ boardId: b.id, kind: 'bevel', plane: { point: { x: 0, y: 0, z: left > 0 ? 0 : T }, normal: { x: -1, y: 0, z: t } } })
  }
  if (right) {
    const t = Math.tan(rad(right))
    cuts.push({ boardId: b.id, kind: 'bevel', plane: { point: { x: W, y: 0, z: right > 0 ? 0 : T }, normal: { x: 1, y: 0, z: t } } })
  }
  return cuts
}

/** All material removed from every board: grooves, holes, miters and bevels (board-local coordinates). */
export function cutGeometry(project: Project): Cut[] {
  const cuts: Cut[] = []
  for (const j of project.joints) {
    if (!isGroove(j)) continue
    const host = boardById(project, j.hostBoardId)
    if (!host) continue
    cuts.push({ boardId: host.id, kind: j.type as 'dado' | 'rabbet', ...grooveBox(host, j.params) })
  }
  for (const b of project.boards) {
    for (const h of b.holes) {
      const depth = h.depth !== undefined ? Math.min(h.depth, b.thickness) : b.thickness
      const z = h.depth !== undefined && (h.face ?? 'top') === 'top' ? b.thickness - depth : 0
      cuts.push({ boardId: b.id, kind: 'hole', center: { x: h.u, y: h.v, z }, diameter: h.diameter, depth })
    }
    cuts.push(...endAndEdgeCuts(b), ...taperCuts(b), ...profileCuts(b))
  }
  return cuts
}

/** True when a board-local point falls in material the cut removes. */
/** `board` is needed for edge-profile cuts (they are measured from its edges). */
export function pointRemovedBy(cut: Cut, p: Vec3, board?: Board): boolean {
  if (cut.kind === 'hole') {
    const dx = p.x - cut.center.x
    const dy = p.y - cut.center.y
    return dx * dx + dy * dy < (cut.diameter / 2) ** 2 && p.z >= cut.center.z && p.z <= cut.center.z + cut.depth
  }
  if (cut.kind === 'profile') {
    if (!board) return false
    const { u, v } = toEdge(board, cut, p)
    return inSection(cut.section, u, v)
  }
  if (cut.kind === 'miter' || cut.kind === 'bevel' || cut.kind === 'taper') {
    const { point, normal } = cut.plane
    return (p.x - point.x) * normal.x + (p.y - point.y) * normal.y + (p.z - point.z) * normal.z > EPS
  }
  const box = cut as BoxCut
  return p.x >= box.min.x && p.x <= box.max.x && p.y >= box.min.y && p.y <= box.max.y && p.z >= box.min.z && p.z <= box.max.z
}

/** A reason the board's angled cuts can't be made, or null. */
export function validateBoard(b: Board): string | null {
  const angles = [b.endCuts.start.miter, b.endCuts.start.bevel, b.endCuts.end.miter, b.endCuts.end.bevel, b.edgeBevels.left, b.edgeBevels.right]
  if (angles.some(a => Math.abs(a) > MAX_ANGLE)) return `${b.name}: angles must be between 0° and ${MAX_ANGLE}°`
  const lost =
    b.width * Math.abs(Math.tan(rad(b.endCuts.start.miter))) +
    b.width * Math.abs(Math.tan(rad(b.endCuts.end.miter))) +
    b.thickness * Math.abs(Math.tan(rad(b.endCuts.start.bevel))) +
    b.thickness * Math.abs(Math.tan(rad(b.endCuts.end.bevel)))
  if (b.length - lost <= EPS) return `${b.name} is too short for those end angles`
  const edgeLost = b.thickness * Math.abs(Math.tan(rad(b.edgeBevels.left))) + b.thickness * Math.abs(Math.tan(rad(b.edgeBevels.right)))
  if (b.width - edgeLost <= EPS) return `${b.name} is too narrow for those edge bevels`
  return null
}

/** A reason the joint can't be made, or null when it is valid. */
export function validateJoint(project: Project, joint: Joint): string | null {
  const host = boardById(project, joint.hostBoardId)
  const partner = boardById(project, joint.partnerBoardId)
  if (!host || !partner) return 'This joint refers to a board that no longer exists'
  if (isGroove(joint)) {
    const p = joint.params
    const name = joint.type
    if (!(p.width > 0)) return `The ${name} width must be more than 0`
    if (!(p.depth > 0)) return `The ${name} depth must be more than 0`
    if (p.face === 'left' || p.face === 'right') {
      if (p.depth > host.width / 2 + EPS) return `The groove is deeper than half of ${host.name}'s width`
      if (p.offset < -EPS || p.offset + p.width > host.thickness + EPS) return `The groove is wider than ${host.name} is thick`
      return null
    }
    if (p.depth > host.thickness / 2 + EPS) return `The ${name} is deeper than half of ${host.name} (${formatInches(host.thickness / 2, { sixtyFourths: true })} max)`
    const extent = (p.along ?? 'width') === 'width' ? host.length : host.width
    if (p.offset < -EPS || p.offset + p.width > extent + EPS) return `The ${name} runs past the end of ${host.name}`
    if (joint.type === 'rabbet' && Math.abs(p.offset) > EPS && Math.abs(p.offset + p.width - extent) > EPS) {
      return `A rabbet must sit at an edge or end of ${host.name}`
    }
    return null
  }
  if (joint.type === 'pocketScrew') {
    const p = joint.params as PocketParams
    if (!(p.count >= 1)) return 'Use at least one pocket screw'
    if (!(p.screwLength > 0)) return 'Screw length must be more than 0'
    return null
  }
  if (joint.type === 'miter') {
    const p = joint.params as MiterParams
    if (!(p.angle > 0 && p.angle <= MAX_ANGLE)) return `Miter angle must be between 0° and ${MAX_ANGLE}°`
    return null
  }
  return null
}

const deg = (a: number) => `${Number(Math.abs(a).toFixed(2))}°`

function angleNotes(b: Board): string[] {
  const notes: string[] = []
  const pair = (s: number, e: number, what: 'miter' | 'bevel') => {
    if (s && e && Math.abs(Math.abs(s) - Math.abs(e)) < 1e-6) notes.push(`${deg(s)} ${what} both ends`)
    else if (s && e) notes.push(`${deg(s)} / ${deg(e)} ${what} ends`)
    else if (s || e) notes.push(what === 'miter' ? `${deg(s || e)} miter one end` : `${deg(s || e)} bevel, one end`)
  }
  pair(b.endCuts.start.miter, b.endCuts.end.miter, 'miter')
  pair(b.endCuts.start.bevel, b.endCuts.end.bevel, 'bevel')
  const { left, right } = b.edgeBevels
  if (left && right && Math.abs(Math.abs(left) - Math.abs(right)) < 1e-6) notes.push(`${deg(left)} bevel, both edges`)
  else {
    if (left) notes.push(`${deg(left)} bevel, left edge`)
    if (right) notes.push(`${deg(right)} bevel, right edge`)
  }
  return notes
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

/** Shop notes for one board: its grooves, holes, fasteners and angled cuts. */
export function jointNotes(project: Project, boardId: string): string[] {
  const b = boardById(project, boardId)
  if (!b) return []
  const notes: string[] = []
  const rabbetCounts = new Map<string, { count: number; along: 'width' | 'length' }>()
  for (const j of project.joints) {
    if (isGroove(j) && j.hostBoardId === boardId) {
      const p = j.params
      if (p.face === 'left' || p.face === 'right') {
        notes.push(`${formatInches(p.width)} groove × ${formatInches(p.depth)} deep in the edge${Math.abs(p.offset * 2 + p.width - b.thickness) < 1e-6 ? ', centred' : `, ${formatInches(p.offset)} from the face`}`)
        continue
      }
      const base = `${formatInches(p.width)} ${j.type} × ${formatInches(p.depth)} deep`
      const along = p.along ?? 'width'
      if (j.type === 'rabbet') {
        const seen = rabbetCounts.get(base)
        if (seen) seen.count += 1
        else {
          rabbetCounts.set(base, { count: 1, along })
          notes.push(base)
        }
      } else if (p.offset === 0) notes.push(base)
      else notes.push(`${base}, ${formatInches(p.offset)} from ${along === 'width' ? 'end' : 'edge'}`)
    }
    if (j.partnerBoardId !== boardId) continue
    if (j.type === 'butt') {
      const p = j.params as ButtParams
      notes.push(p.fastener === 'glue' ? 'Butt joint: glue' : `Butt joint: ${plural(p.count, p.fastener === 'screws' ? 'screw' : 'nail')}`)
    } else if (j.type === 'pocketScrew') {
      const p = j.params as PocketParams
      const base = `${plural(p.count, 'pocket screw')} (${formatInches(p.screwLength)})`
      notes.push(p.count > 1 ? `${base}, ${formatInches(p.spacing)} apart` : base)
    }
  }
  // A metric drill (5 mm shelf pins) reads in millimetres.
  const dia = (d: number) => { const mm = d * 25.4; return Math.abs(mm - Math.round(mm)) < 0.01 && Math.abs(d * 64 - Math.round(d * 64)) > 1e-6 ? `${Math.round(mm)} mm` : formatInches(d) }
  // Many alike stopped holes (shelf pins) are one line; others each get their own.
  const alike = new Map<string, number>()
  for (const h of b.holes) if (h.depth !== undefined) { const k = `${h.diameter}:${h.depth}`; alike.set(k, (alike.get(k) ?? 0) + 1) }
  const counted = new Set<string>()
  for (const h of b.holes) {
    const deep = h.depth !== undefined ? `, ${formatInches(h.depth)} deep` : ''
    const k = `${h.diameter}:${h.depth}`
    if (h.depth !== undefined && (alike.get(k) ?? 0) > 3) {
      if (!counted.has(k)) { counted.add(k); notes.push(`${alike.get(k)} × ${dia(h.diameter)} holes${deep} (shelf pins)`) }
      continue
    }
    const where = Math.abs(h.u - b.width / 2) < 1e-6 ? 'centered' : `${formatInches(h.u)} from edge`
    notes.push(`${dia(h.diameter)} hole${deep}, ${formatInches(h.v)} from end, ${where}`)
  }
  notes.push(...angleNotes(b))
  const withBoth = notes.map(n => {
    const r = rabbetCounts.get(n)
    return r && r.count > 1 ? `${n}, both ${r.along === 'width' ? 'ends' : 'edges'}` : n
  })
  return [...new Set(withBoth)]
}
