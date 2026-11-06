// Design warnings: overlapping boards, parts bigger than the stock, and joints or angles that can't be made.
import { contactOfBoards, grooveIndex, TOUCH_TOL } from './contact'
import { type Box, boxInLocal, isAxisAligned, worldBox } from './geometry'
import { validateBoard, validateJoint } from './joints'
import type { Board, GrooveParams, Joint, Project } from './types'
import { formatInches } from './units'
import { findWood } from './woods'
import { outlinePolygons, shapeReaches } from './shaped'
import { MSG_GAPS, MSG_SQUARE, turningProblem } from '../shaping/turning'
import { taperProblem } from '../shaping/taper'
import { edgeProblemFor, PROFILE_NAMES } from '../shaping/edges'

/** Where a warning's "Why?" goes in the Deep Library, with the values to open it with. */
export type LibraryLink =
  | { page: 'movement'; width: number; speciesId: string }
  | { page: 'sag'; span: number; depth: number; thickness: number; moe: number; material: string }
export type Warning = { kind: 'overlap' | 'exceedsStock' | 'badJoint' | 'badShape' | 'formula' | 'crossGrain' | 'sag'; boardIds: string[]; message: string; link?: LibraryLink }

/**
 * Index pairs (i < k, in the order a double loop would find them) of boards whose boxes overlap by more than the
 * touching tolerance on every axis. Sweeps along x instead of testing every pair, and works out each box once.
 */
export function overlappingPairs(boards: Board[], boxOf: (b: Board) => Box = worldBox): [number, number][] {
  const boxes = boards.map(boxOf)
  const order = boards.map((_, i) => i).sort((p, q) => boxes[p].min.x - boxes[q].min.x)
  const pairs: [number, number][] = []
  // overlap1(aMin, aMax, bMin, bMax) > TOUCH_TOL on each axis, written out: this is the hot loop.
  const over = (aMin: number, aMax: number, bMin: number, bMax: number) => Math.min(aMax, bMax) - Math.max(aMin, bMin) > TOUCH_TOL
  for (let n = 0; n < order.length; n++) {
    const p = order[n]
    const A = boxes[p]
    for (let m = n + 1; m < order.length; m++) {
      const q = order[m]
      const B = boxes[q]
      // Sorted by left edge: once one starts at or past this one's right edge (less the tolerance), none later can overlap.
      if (B.min.x >= A.max.x - TOUCH_TOL) break
      if (over(A.min.y, A.max.y, B.min.y, B.max.y) && over(A.min.z, A.max.z, B.min.z, B.max.z) && over(A.min.x, A.max.x, B.min.x, B.max.x)) {
        pairs.push(p < q ? [p, q] : [q, p])
      }
    }
  }
  return pairs.sort((x, y) => x[0] - y[0] || x[1] - y[1])
}

export function validate(project: Project): Warning[] {
  const warnings: Warning[] = []

  const joined = new Set(project.joints.flatMap(j => [`${j.hostBoardId}|${j.partnerBoardId}`, `${j.partnerBoardId}|${j.hostBoardId}`]))
  // Each part's box is worked out once and shared by the overlap sweep, the contact checks and the groove seats.
  const boxCache = new Map<Board, Box>()
  const boxOf = (b: Board): Box => { let x = boxCache.get(b); if (!x) boxCache.set(b, (x = worldBox(b))); return x }
  const boards = project.boards.filter(isAxisAligned)
  for (const [i, k] of overlappingPairs(boards, boxOf)) {
    const a = boards[i]
    const b = boards[k]
    if (joined.has(`${a.id}|${b.id}`)) continue
    warnings.push({ kind: 'overlap', boardIds: [a.id, b.id], message: `${a.name} and ${b.name} overlap` })
  }

  for (const b of project.boards) {
    const wood = findWood(project, b.woodId)
    if (!wood) {
      warnings.push({ kind: 'exceedsStock', boardIds: [b.id], message: `${b.name} uses a wood that isn't in the library` })
      continue
    }
    if (Math.abs(b.thickness - wood.thickness) > 1e-9) {
      warnings.push({ kind: 'exceedsStock', boardIds: [b.id], message: `${b.name}: Thickness doesn't match ${wood.name}` })
    }
    if (b.length > wood.length + 1e-9) {
      warnings.push({ kind: 'exceedsStock', boardIds: [b.id], message: `${b.name} is longer than ${wood.name} (${formatInches(wood.length)})` })
    }
    if (b.width > wood.width + 1e-9) {
      warnings.push({ kind: 'exceedsStock', boardIds: [b.id], message: `${b.name} is wider than ${wood.name} (${formatInches(wood.width)})` })
    }
    if (b.outline && !outlinePolygons(project, b)) {
      warnings.push({ kind: 'badShape', boardIds: [b.id], message: `${b.name}'s drawing isn't a closed shape — it shows as a plain rectangle until it is` })
    }
    const turn = turningProblem(project, b)
    if (turn) {
      const msg = turn === MSG_SQUARE ? `${b.name}'s turning needs a square blank — it shows square until the blank is square again`
        : turn === MSG_GAPS ? `${b.name}'s turning profile must run from the pommel to the foot without gaps`
          : `${b.name}: ${turn}`
      warnings.push({ kind: 'badShape', boardIds: [b.id], message: msg })
    }
    if (b.taper && !b.turning) {
      const tp = taperProblem(b, b.taper)
      if (tp) warnings.push({ kind: 'badShape', boardIds: [b.id], message: `${b.name}'s taper doesn't fit any more — ${tp}. It isn't shown until it fits.` })
    }
    for (const e of b.edges ?? []) {
      const ep = edgeProblemFor(b, b.edges!, e)
      if (ep) warnings.push({ kind: 'badShape', boardIds: [b.id], message: `${b.name}: the ${formatInches(e.size)} ${PROFILE_NAMES[e.profile]} doesn't fit any more — ${ep}. It isn't shown until it fits.` })
    }
    const angleProblem = validateBoard(b)
    if (angleProblem) warnings.push({ kind: 'badJoint', boardIds: [b.id], message: angleProblem })
  }

  // First board with an id wins, as a find() would.
  const byId = new Map<string, Board>()
  for (const b of project.boards) if (!byId.has(b.id)) byId.set(b.id, b)
  const grooveOf = grooveIndex(project.joints)
  const contact = (aId: string, bId: string) => {
    const a = byId.get(aId), b = byId.get(bId)
    return a && b ? contactOfBoards(a, b, grooveOf(a.id, b.id), boxOf) : null
  }
  const NAMES: Record<string, string> = { butt: 'butt', dado: 'dado', rabbet: 'rabbet', pocketScrew: 'pocket-screw', miter: 'miter', joinery: 'cut' }
  for (const j of project.joints) {
    const reason = validateJoint(project, j)
    if (reason) {
      warnings.push({ kind: 'badJoint', boardIds: [j.hostBoardId, j.partnerBoardId], message: reason })
      continue
    }
    // A joint only means something while its boards still meet the way it describes.
    // Frame-and-panel cuts (edge grooves, tenon cheeks, glass rabbets) are checked by their own seat, not by contact.
    const gp = j.params as GrooveParams
    // Cut joints check where their parts are themselves (joinery problems are reported above).
    const own = j.type === 'joinery' || ((j.type === 'dado' || j.type === 'rabbet') && (gp.face === 'left' || gp.face === 'right' || gp.standalone))
    if ((!own && !contact(j.hostBoardId, j.partnerBoardId)) || !seatedInGroove(byId, j, boxOf)) {
      const name = (id: string) => byId.get(id)?.name ?? '?'
      warnings.push({
        kind: 'badJoint',
        boardIds: [j.hostBoardId, j.partnerBoardId],
        message: `The ${NAMES[j.type]} joint between ${name(j.hostBoardId)} and ${name(j.partnerBoardId)} no longer lines up — move them back together or remove the joint`
      })
      continue
    }
    // A shaped part may have been cut away right where the joint is.
    const host = byId.get(j.hostBoardId)!
    const partner = byId.get(j.partnerBoardId)!
    for (const [s, o] of [[host, partner], [partner, host]]) {
      if (s.outline && !shapeReaches(project, s, o)) {
        warnings.push({ kind: 'badJoint', boardIds: [s.id, o.id], message: `The shape of ${s.name} doesn't reach where it joins ${o.name}` })
      }
    }
  }
  return warnings
}

/** For a dado or rabbet: the partner board still sits inside the groove (not just somewhere on the host's face). */
function seatedInGroove(byId: Map<string, Board>, j: Joint, boxOf: (b: Board) => Box): boolean {
  if (j.type !== 'dado' && j.type !== 'rabbet') return true
  const host = byId.get(j.hostBoardId)
  const partner = byId.get(j.partnerBoardId)
  if (!host || !partner || !isAxisAligned(host) || !isAxisAligned(partner)) return true
  const p = j.params as GrooveParams
  if (p.standalone) return true
  const local = boxInLocal(host, boxOf(partner))
  // An edge groove: the partner reaches into it no further than its depth.
  if (p.face === 'left') return local.max.x <= p.depth + TOUCH_TOL
  if (p.face === 'right') return local.min.x >= host.width - p.depth - TOUCH_TOL
  const ax = (p.along ?? 'width') === 'width' ? 'y' : 'x'
  return local.min[ax] >= p.offset - TOUCH_TOL && local.max[ax] <= p.offset + p.width + TOUCH_TOL
}
