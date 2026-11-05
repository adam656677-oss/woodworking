// How two boards meet, and which joints make sense for that meeting.
import { AXES, type Axis, type Box, isAxisAligned, localAxes, overlap1, worldBox } from './geometry'
import type { Board, GrooveParams, Joint, JointType, Project } from './types'

export type Contact = {
  kind: 'endToFace' | 'edgeToFace' | 'faceToFace' | 'cornerEnds' | 'endToEdge' | 'edgeToEdge' | 'endToEnd'
  host: string
  partner: string
  nearHostEnd: boolean
  cornerAngle?: number
  /** For cornerEnds: whether the partner's end meets the host's face (box corner) or edge (frame corner). */
  hostSurface?: 'face' | 'edge'
}

/** Coplanar within 1/64". */
export const TOUCH_TOL = 1 / 64
const AREA_MIN = 1e-6

type Part = 'end' | 'edge' | 'face'

function partOn(b: Board, axis: Axis): Part {
  const a = localAxes(b)
  if (a.length.axis === axis) return 'end'
  if (a.width.axis === axis) return 'edge'
  return 'face'
}

/** Along the host's length axis, the gap from the contact patch to the nearer host end. */
function patchToHostEnd(host: Board, hb: Box, pb: Box): number {
  const ax = localAxes(host).length.axis
  const lo = Math.max(hb.min[ax], pb.min[ax])
  const hi = Math.min(hb.max[ax], pb.max[ax])
  return Math.min(lo - hb.min[ax], hb.max[ax] - hi)
}

/** Partner's outer surface flush with the host's end (along the host's length axis). */
function flushWithHostEnd(host: Board, hb: Box, pb: Box): boolean {
  const ax = localAxes(host).length.axis
  return Math.abs(pb.min[ax] - hb.min[ax]) <= TOUCH_TOL || Math.abs(pb.max[ax] - hb.max[ax]) <= TOUCH_TOL
}

function hasMiteredEnd(b: Board): boolean {
  return b.endCuts.start.miter !== 0 || b.endCuts.end.miter !== 0
}

/** How boards a and b meet, or null when they don't touch (or aren't square to each other). */
export function contactBetween(project: Project, aId: string, bId: string): Contact | null {
  const a = project.boards.find(b => b.id === aId)
  const b = project.boards.find(b => b.id === bId)
  if (!a || !b) return null
  return contactOfBoards(a, b, grooveBetween(project.joints, a.id, b.id))
}

/** The first dado or rabbet joint between two boards, in either direction. */
export function grooveBetween(joints: Joint[], aId: string, bId: string): Joint | undefined {
  return joints.find(
    j => (j.type === 'dado' || j.type === 'rabbet') &&
      ((j.hostBoardId === aId && j.partnerBoardId === bId) || (j.hostBoardId === bId && j.partnerBoardId === aId))
  )
}

/** Looks up the first dado or rabbet between any two boards without scanning every joint each time. */
export function grooveIndex(joints: Joint[]): (aId: string, bId: string) => Joint | undefined {
  const m = new Map<string, Joint>()
  for (const j of joints) {
    if (j.type !== 'dado' && j.type !== 'rabbet') continue
    for (const k of [`${j.hostBoardId}|${j.partnerBoardId}`, `${j.partnerBoardId}|${j.hostBoardId}`]) if (!m.has(k)) m.set(k, j)
  }
  return (aId, bId) => m.get(`${aId}|${bId}`)
}

/** contactBetween for two boards already in hand (and the groove joint between them, if any). */
export function contactOfBoards(a: Board, b: Board, groove: Joint | undefined, boxOf: (b: Board) => Box = worldBox): Contact | null {
  if (a === b || !isAxisAligned(a) || !isAxisAligned(b)) return null
  const A = boxOf(a)
  const B = boxOf(b)
  const ov = AXES.map(ax => overlap1(A.min[ax], A.max[ax], B.min[ax], B.max[ax]))

  // Mitered corner: the boxes overlap in a corner region where both boards have mitered ends.
  if (ov.every(o => o > TOUCH_TOL) && hasMiteredEnd(a) && hasMiteredEnd(b)) {
    const la = localAxes(a).length.axis
    const lb = localAxes(b).length.axis
    if (la !== lb) return { kind: 'cornerEnds', host: a.id, partner: b.id, nearHostEnd: true, cornerAngle: 90, hostSurface: 'edge' }
  }

  // A board seated in a dado/rabbet overlaps its host by up to the groove depth; that still counts as touching.
  const seat = groove ? (groove.params as GrooveParams).depth : 0

  // Touching: coplanar on exactly one axis (or seated in a groove), positive area on the other two.
  let touchAxes = AXES.filter((ax, i) => Math.abs(ov[i]) <= TOUCH_TOL)
  if (touchAxes.length === 0 && seat > 0) {
    const seated = AXES.filter((ax, i) => Math.abs(ov[i] - seat) <= 1e-6) // sizes are on the 1/64" grid, so the seat matches exactly
    if (seated.length === 1) touchAxes = seated
  }
  if (touchAxes.length !== 1) return null
  const t = touchAxes[0]
  if (AXES.some((ax, i) => ax !== t && ov[i] <= AREA_MIN)) return null

  const pa = partOn(a, t)
  const pb = partOn(b, t)
  if (pa === 'face' && pb === 'face') return { kind: 'faceToFace', host: a.id, partner: b.id, nearHostEnd: false }

  // The board touching with its end (or edge) is the partner; the one touching with its face (or edge) hosts.
  const order: Part[] = ['end', 'edge', 'face']
  // Two edges or two ends: neither is the natural host, so the one on the low side (left, front, bottom) hosts,
  // whichever order the two are asked about in.
  const same = pa === pb && (pa === 'edge' || pa === 'end')
  const aFirst = same ? A.min[t] > B.min[t] : order.indexOf(pa) <= order.indexOf(pb)
  const [partner, host, pPart, hPart] = aFirst ? [a, b, pa, pb] : [b, a, pb, pa]
  const hb = boxOf(host)
  const pbx = boxOf(partner)

  if (pPart === 'end' && hPart !== 'end' && flushWithHostEnd(host, hb, pbx)) {
    return { kind: 'cornerEnds', host: host.id, partner: partner.id, nearHostEnd: true, cornerAngle: 90, hostSurface: hPart === 'face' ? 'face' : 'edge' }
  }
  // Two boards edge to edge (a glued-up panel), or two beams end to end in line (a splice).
  if (pPart === 'edge' && hPart === 'edge') return { kind: 'edgeToEdge', host: host.id, partner: partner.id, nearHostEnd: false }
  if (pPart === 'end' && hPart === 'end') return { kind: 'endToEnd', host: host.id, partner: partner.id, nearHostEnd: false }
  // A frame's rail ending against a stile's edge partway along it (face frames, doors).
  if (pPart === 'end' && hPart === 'edge') return { kind: 'endToEdge', host: host.id, partner: partner.id, nearHostEnd: false }
  if (hPart !== 'face') return null
  const near = patchToHostEnd(host, hb, pbx) <= host.thickness + TOUCH_TOL
  if (pPart === 'end') return { kind: 'endToFace', host: host.id, partner: partner.id, nearHostEnd: near }
  return { kind: 'edgeToFace', host: host.id, partner: partner.id, nearHostEnd: near }
}

/** The joints that make sense for a contact, in menu order. */
export function jointOffers(c: Contact): JointType[] {
  switch (c.kind) {
    case 'endToFace':
      return c.nearHostEnd ? ['butt', 'dado', 'pocketScrew', 'rabbet'] : ['butt', 'dado', 'pocketScrew']
    case 'edgeToFace':
      return ['butt', 'dado', 'rabbet']
    case 'faceToFace':
      return ['butt']
    case 'endToEdge':
      return ['butt', 'pocketScrew']
    case 'cornerEnds':
      return c.hostSurface === 'face' ? ['butt', 'miter', 'rabbet', 'pocketScrew'] : ['butt', 'miter']
    case 'edgeToEdge':
    case 'endToEnd':
      return ['butt']
  }
}
