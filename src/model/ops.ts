// Pure edit operations. Every function returns a new Project and never mutates its input.
import { contactBetween, jointOffers, type Contact } from './contact'
import { AXES, type Axis, boxInLocal, faceToward, localAxes, rotateVec, worldBox } from './geometry'
import { newId } from './ids'
import { MAX_ANGLE, validateJoint } from './joints'
import type {
  Board, ButtParams, EndCut, GrooveParams, Joint, JointRestore, JointType, MiterParams, PocketParams, Project, Vec3
} from './types'
import { snap64 } from './units'
import { findWood } from './woods'

export type OpError = { error: string }

const snapVec = (v: Vec3): Vec3 => ({ x: snap64(v.x), y: snap64(v.y), z: snap64(v.z) })
const clean = (n: number) => Math.round(n * 1e9) / 1e9 + 0
const ANGLE_ERROR = `Angles must be between 0° and ${MAX_ANGLE}°`

function mapBoard(p: Project, id: string, fn: (b: Board) => Board): Project {
  return { ...p, boards: p.boards.map(b => (b.id === id ? fn(b) : b)) }
}

function getBoard(p: Project, id: string): Board {
  const b = p.boards.find(x => x.id === id)
  if (!b) throw new Error(`No board ${id}`)
  return b
}

// ── boards ────────────────────────────────────────────────────────────────

export function addBoard(p: Project, init: Partial<Board> & { woodId: string }): { project: Project; id: string } {
  const wood = findWood(p, init.woodId)
  if (!wood) throw new Error(`Wood ${init.woodId} is not in this project`)
  const id = newId('b')
  const b: Board = {
    id,
    name: 'Board',
    thickness: wood.thickness,
    width: Math.min(wood.width, 6),
    length: 12,
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    grain: 'length',
    holes: [],
    endCuts: { start: { miter: 0, bevel: 0 }, end: { miter: 0, bevel: 0 } },
    edgeBevels: { left: 0, right: 0 },
    ...init
  }
  b.id = id
  b.width = snap64(b.width)
  b.length = snap64(b.length)
  b.position = snapVec(b.position)
  return { project: { ...p, boards: [...p.boards, b] }, id }
}

export function updateBoard(p: Project, id: string, patch: Partial<Board>): Project {
  return mapBoard(p, id, b => {
    const n = { ...b, ...patch }
    for (const k of ['thickness', 'width', 'length'] as const) n[k] = snap64(n[k])
    n.position = snapVec(n.position)
    return n
  })
}

/**
 * Switch a board to another wood: thickness always follows. Between dimensional lumber sizes, a board that
 * was the full width of its stock (a 1x4 used as-is) takes the new stock's width; otherwise width is kept.
 */
export function changeWood(p: Project, id: string, woodId: string): Project {
  const wood = findWood(p, woodId)
  if (!wood) return p
  return mapBoard(p, id, b => {
    const old = findWood(p, b.woodId)
    const fullWidth = old?.kind === 'lumber' && wood.kind === 'lumber' && Math.abs(b.width - old.width) < 1e-9
    return { ...b, woodId, thickness: wood.thickness, width: fullWidth ? snap64(wood.width) : b.width }
  })
}

export function moveBoard(p: Project, id: string, position: Vec3): Project {
  return mapBoard(p, id, b => ({ ...b, position: snapVec(position) }))
}

export function renameBoard(p: Project, id: string, name: string): Project {
  return mapBoard(p, id, b => ({ ...b, name }))
}

const center = (b: Board): Vec3 => {
  const w = worldBox(b)
  return { x: (w.min.x + w.max.x) / 2, y: (w.min.y + w.max.y) / 2, z: (w.min.z + w.max.z) / 2 }
}

/** Rotate about the board's center. */
export function rotateBoard(p: Project, id: string, axis: Axis, degrees: number): Project {
  return mapBoard(p, id, b => {
    const before = center(b)
    let r = (b.rotation[axis] + degrees) % 360
    if (r > 180) r -= 360
    if (r <= -180) r += 360
    const turned = { ...b, rotation: { ...b.rotation, [axis]: r } }
    const after = center(turned)
    return {
      ...turned,
      position: {
        x: clean(b.position.x + before.x - after.x),
        y: clean(b.position.y + before.y - after.y),
        z: clean(b.position.z + before.z - after.z)
      }
    }
  })
}

export function duplicateBoards(p: Project, ids: string[]): { project: Project; ids: string[] } {
  const map = new Map<string, string>()
  const copies = p.boards
    .filter(b => ids.includes(b.id))
    .map(b => {
      const id = newId('b')
      map.set(b.id, id)
      return { ...structuredClone(b), id, name: `${b.name} (copy)`, position: { ...b.position, x: snap64(b.position.x + 1) } }
    })
  const joints = p.joints
    .filter(j => map.has(j.hostBoardId) && map.has(j.partnerBoardId))
    .map(j => ({
      ...structuredClone(j),
      id: newId('j'),
      hostBoardId: map.get(j.hostBoardId)!,
      partnerBoardId: map.get(j.partnerBoardId)!,
      restore: j.restore?.map(r => ({ ...r, boardId: map.get(r.boardId) ?? r.boardId }))
    }))
  return { project: { ...p, boards: [...p.boards, ...copies], joints: [...p.joints, ...joints] }, ids: copies.map(c => c.id) }
}

/** Mirror the selection across its own center plane on `axis`. Miter angles flip so parts stay correct. */
export function mirrorBoards(p: Project, ids: string[], axis: Axis): Project {
  const sel = p.boards.filter(b => ids.includes(b.id))
  if (sel.length === 0) return p
  const boxes = sel.map(worldBox)
  const c = (Math.min(...boxes.map(b => b.min[axis])) + Math.max(...boxes.map(b => b.max[axis]))) / 2
  return {
    ...p,
    boards: p.boards.map(b => {
      if (!ids.includes(b.id)) return b
      const w = worldBox(b)
      const shift = 2 * c - w.max[axis] - w.min[axis]
      const flip = (e: EndCut): EndCut => ({ ...e, miter: e.miter === 0 ? 0 : -e.miter })
      return {
        ...b,
        position: { ...b.position, [axis]: clean(b.position[axis] + shift) },
        endCuts: { start: flip(b.endCuts.start), end: flip(b.endCuts.end) }
      }
    })
  }
}

/** Line up every selected board with the first selected one. */
export function alignBoards(p: Project, ids: string[], axis: Axis, mode: 'min' | 'center' | 'max'): Project {
  const ref = p.boards.find(b => b.id === ids[0])
  if (!ref) return p
  const r = worldBox(ref)
  const target = mode === 'min' ? r.min[axis] : mode === 'max' ? r.max[axis] : (r.min[axis] + r.max[axis]) / 2
  return {
    ...p,
    boards: p.boards.map(b => {
      if (b.id === ref.id || !ids.includes(b.id)) return b
      const w = worldBox(b)
      const current = mode === 'min' ? w.min[axis] : mode === 'max' ? w.max[axis] : (w.min[axis] + w.max[axis]) / 2
      return { ...b, position: { ...b.position, [axis]: clean(b.position[axis] + target - current) } }
    })
  }
}

/** Delete boards. Their joints are removed first, so what a joint did to the surviving board is undone. */
export function deleteBoards(p: Project, ids: string[]): Project {
  let next = p
  for (const j of p.joints) {
    if (ids.includes(j.hostBoardId) || ids.includes(j.partnerBoardId)) next = removeJoint(next, j.id)
  }
  return { ...next, boards: next.boards.filter(b => !ids.includes(b.id)) }
}

export function setEndCut(p: Project, id: string, end: 'start' | 'end', cut: Partial<EndCut>): Project | OpError {
  if (Object.values(cut).some(a => a !== undefined && Math.abs(a) > MAX_ANGLE)) return { error: ANGLE_ERROR }
  return mapBoard(p, id, b => ({ ...b, endCuts: { ...b.endCuts, [end]: { ...b.endCuts[end], ...cut } } }))
}

export function setEdgeBevel(p: Project, id: string, edge: 'left' | 'right', degrees: number): Project | OpError {
  if (Math.abs(degrees) > MAX_ANGLE) return { error: ANGLE_ERROR }
  return mapBoard(p, id, b => ({ ...b, edgeBevels: { ...b.edgeBevels, [edge]: degrees } }))
}

// ── resizing one end or edge, keeping the other fixed in the world ─────────

type Side = JointRestore['side']

/** Grow (or shrink) a board at one end/edge; the opposite end/edge stays put. Holes and grooves stay in place. */
function resizeAt(p: Project, id: string, side: Side, delta: number): Project {
  if (delta === 0) return p
  const b = getBoard(p, id)
  const lengthwise = side === 'start' || side === 'end'
  const atOrigin = side === 'start' || side === 'left'
  const next: Board = lengthwise ? { ...b, length: snap64(b.length + delta) } : { ...b, width: snap64(b.width + delta) }
  let joints = p.joints
  if (atOrigin) {
    const dir = rotateVec(lengthwise ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 }, b.rotation)
    next.position = {
      x: clean(b.position.x - dir.x * delta),
      y: clean(b.position.y - dir.y * delta),
      z: clean(b.position.z - dir.z * delta)
    }
    next.holes = b.holes.map(h => (lengthwise ? { ...h, v: h.v + delta } : { ...h, u: h.u + delta }))
    joints = p.joints.map(j => {
      if (j.hostBoardId !== id || (j.type !== 'dado' && j.type !== 'rabbet')) return j
      const gp = j.params as GrooveParams
      const along = gp.along ?? 'width'
      const shifts = (along === 'width') === lengthwise
      return shifts ? { ...j, params: { ...gp, offset: snap64(gp.offset + delta) } } : j
    })
  }
  return { ...p, joints, boards: p.boards.map(x => (x.id === id ? next : x)) }
}

/** Which end (or edge) of `b` faces `other`. */
function sideFacing(b: Board, other: Board, lengthwise: boolean): Side {
  const o = boxInLocal(b, worldBox(other))
  if (lengthwise) return (o.min.y + o.max.y) / 2 < b.length / 2 ? 'start' : 'end'
  return (o.min.x + o.max.x) / 2 < b.width / 2 ? 'left' : 'right'
}

// ── joints ────────────────────────────────────────────────────────────────

const LABEL: Record<JointType, string> = {
  butt: 'A butt joint', dado: 'A dado', rabbet: 'A rabbet', pocketScrew: 'A pocket-screw joint', miter: 'A miter'
}

export function addJoint(
  p: Project, type: JointType, hostId: string, partnerId: string, params: Record<string, unknown> = {}
): { project: Project; id: string } | OpError {
  const c = contactBetween(p, hostId, partnerId)
  if (!c) return { error: "These boards don't touch" }
  if (!jointOffers(c).includes(type)) return { error: `${LABEL[type]} can't join these boards` }
  const host = getBoard(p, c.host)
  const partner = getBoard(p, c.partner)
  const id = newId('j')

  if (type === 'butt' || type === 'pocketScrew') {
    const defaults = type === 'butt' ? { fastener: 'glue', count: 0 } : { count: 2, spacing: 4, screwLength: 1.25 }
    const joint: Joint = { id, type, hostBoardId: host.id, partnerBoardId: partner.id, params: { ...defaults, ...params } as ButtParams | PocketParams }
    return { project: { ...p, joints: [...p.joints, joint] }, id }
  }
  if (type === 'dado' || type === 'rabbet') return addGroove(p, c, type, host, partner, id, params)
  return addMiter(p, c, host, partner, id, params)
}

function addGroove(
  p: Project, c: Contact, type: 'dado' | 'rabbet', host: Board, partner: Board, id: string, params: Record<string, unknown>
): { project: Project; id: string } | OpError {
  const depth = snap64((params.depth as number) ?? Math.min(0.25, host.thickness / 2))
  const pl = boxInLocal(host, worldBox(partner))
  const spanY = pl.max.y - pl.min.y
  const spanX = pl.max.x - pl.min.x
  const along: 'width' | 'length' = spanY <= spanX ? 'width' : 'length'
  const extent = along === 'width' ? host.length : host.width
  const lo = along === 'width' ? pl.min.y : pl.min.x
  const hi = along === 'width' ? pl.max.y : pl.max.x
  let offset = lo
  let width = (params.width as number) ?? hi - lo
  if (type === 'rabbet') {
    if (lo < extent - hi) {
      offset = 0
      width = (params.width as number) ?? hi
    } else {
      width = (params.width as number) ?? extent - lo
      offset = extent - width
    }
  }
  const gp: GrooveParams = {
    width: snap64(Math.max(0, width)), depth, offset: snap64(Math.max(0, offset)), face: faceToward(host, partner), along
  }
  const lengthwise = c.kind !== 'edgeToFace'
  const side = sideFacing(partner, host, lengthwise)
  const joint: Joint = {
    id, type, hostBoardId: host.id, partnerBoardId: partner.id, params: gp,
    restore: [{ boardId: partner.id, side, extend: depth }]
  }
  const next = resizeAt({ ...p, joints: [...p.joints, joint] }, partner.id, side, depth)
  const reason = validateJoint(next, joint)
  if (reason) return { error: reason }
  return { project: next, id }
}

function axisOf(b: Board, which: 'width' | 'thickness') {
  return localAxes(b)[which]
}

/** +1 if the board's inner side (away from where it is flush with `other`) is the local + direction. */
function innerSign(b: Board, other: Board, which: 'width' | 'thickness'): 1 | -1 {
  const a = axisOf(b, which)
  const bb = worldBox(b)
  const ob = worldBox(other)
  const flushAtMin = Math.abs(bb.min[a.axis] - ob.min[a.axis]) <= Math.abs(bb.max[a.axis] - ob.max[a.axis])
  const innerWorld = flushAtMin ? 1 : -1
  return (innerWorld * a.sign) as 1 | -1
}

function addMiter(
  p: Project, c: Contact, host: Board, partner: Board, id: string, params: Record<string, unknown>
): { project: Project; id: string } | OpError {
  const angle = (params.angle as number) ?? (c.cornerAngle ?? 90) / 2
  if (!(angle > 0 && angle <= MAX_ANGLE)) return { error: ANGLE_ERROR }
  const field: 'miter' | 'bevel' = c.hostSurface === 'face' ? 'bevel' : 'miter'
  const across: 'width' | 'thickness' = field === 'miter' ? 'width' : 'thickness'

  // Extend the board that stopped at the corner by the other board's extent across the corner.
  const touchAxis = localAxes(partner).length.axis
  const hb = worldBox(host)
  const extend = c.nearHostEnd && boxesOverlap(host, partner) ? 0 : snap64(hb.max[touchAxis] - hb.min[touchAxis])
  const pSide = sideFacing(partner, host, true) as 'start' | 'end'
  let next = resizeAt(p, partner.id, pSide, extend)
  const partner2 = getBoard(next, partner.id)
  const host2 = getBoard(next, host.id)
  const hSide = sideFacing(host2, partner2, true) as 'start' | 'end'

  const restore: JointRestore[] = [
    { boardId: partner.id, side: pSide, extend, field, previous: partner2.endCuts[pSide][field] },
    { boardId: host.id, side: hSide, extend: 0, field, previous: host2.endCuts[hSide][field] }
  ]
  const pSign = innerSign(partner2, host2, across)
  const hSign = innerSign(host2, partner2, across)
  next = mapBoard(next, partner.id, b => ({ ...b, endCuts: { ...b.endCuts, [pSide]: { ...b.endCuts[pSide], [field]: pSign * angle } } }))
  next = mapBoard(next, host.id, b => ({ ...b, endCuts: { ...b.endCuts, [hSide]: { ...b.endCuts[hSide], [field]: hSign * angle } } }))
  const mp: MiterParams = { angle, fastener: (params.fastener as MiterParams['fastener']) ?? 'glue' }
  const joint: Joint = { id, type: 'miter', hostBoardId: host.id, partnerBoardId: partner.id, params: mp, restore }
  return { project: { ...next, joints: [...next.joints, joint] }, id }
}

function boxesOverlap(a: Board, b: Board): boolean {
  const A = worldBox(a)
  const B = worldBox(b)
  return AXES.every(ax => Math.min(A.max[ax], B.max[ax]) - Math.max(A.min[ax], B.min[ax]) > 1 / 64)
}

/**
 * What a joint changed on its boards. Joints made by templates (and older files) have no record,
 * so for grooves it is worked out from how the boards sit: the partner went `depth` into the host.
 */
function restoreOf(p: Project, j: Joint): JointRestore[] {
  if (j.restore) return j.restore
  if (j.type !== 'dado' && j.type !== 'rabbet') return []
  const host = p.boards.find(b => b.id === j.hostBoardId)
  const partner = p.boards.find(b => b.id === j.partnerBoardId)
  if (!host || !partner) return []
  const lengthwise = localAxes(partner).length.axis === localAxes(host).thickness.axis
  return [{ boardId: partner.id, side: sideFacing(partner, host, lengthwise), extend: (j.params as GrooveParams).depth }]
}

/** Change a joint's settings. A groove depth change moves the partner in or out of the groove. */
export function updateJoint(p: Project, id: string, params: Record<string, unknown>): Project {
  const j0 = p.joints.find(x => x.id === id)
  if (!j0) return p
  const j = { ...j0, restore: restoreOf(p, j0) }
  let next = p
  let restore = j.restore
  const merged = { ...j.params, ...params } as Joint['params']
  if ((j.type === 'dado' || j.type === 'rabbet') && params.depth !== undefined) {
    const old = (j.params as GrooveParams).depth
    const nd = snap64(params.depth as number)
    ;(merged as GrooveParams).depth = nd
    const delta = nd - old
    restore = (j.restore ?? []).map(r => (r.boardId === j.partnerBoardId ? { ...r, extend: snap64(r.extend + delta) } : r))
    const r0 = j.restore?.find(r => r.boardId === j.partnerBoardId)
    if (r0) next = resizeAt(next, j.partnerBoardId, r0.side, delta)
  }
  if (j.type === 'miter' && params.angle !== undefined) {
    const a = params.angle as number
    for (const r of j.restore ?? []) {
      if (!r.field) continue
      const end = r.side as 'start' | 'end'
      next = mapBoard(next, r.boardId, b => {
        const cur = b.endCuts[end][r.field!]
        return { ...b, endCuts: { ...b.endCuts, [end]: { ...b.endCuts[end], [r.field!]: Math.sign(cur || 1) * a } } }
      })
    }
  }
  return { ...next, joints: next.joints.map(x => (x.id === id ? { ...x, params: merged, restore } : x)) }
}

/** Remove a joint and undo exactly what it changed on its boards. */
export function removeJoint(p: Project, id: string): Project {
  const j = p.joints.find(x => x.id === id)
  if (!j) return p
  const restore = restoreOf(p, j)
  let next: Project = { ...p, joints: p.joints.filter(x => x.id !== id) }
  for (const r of restore) {
    if (!next.boards.some(b => b.id === r.boardId)) continue
    next = resizeAt(next, r.boardId, r.side, -r.extend)
    if (r.field) {
      const end = r.side as 'start' | 'end'
      next = mapBoard(next, r.boardId, b => ({ ...b, endCuts: { ...b.endCuts, [end]: { ...b.endCuts[end], [r.field!]: r.previous ?? 0 } } }))
    }
  }
  return next
}
