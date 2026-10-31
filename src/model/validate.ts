// Design warnings: overlapping boards, parts bigger than the stock, and joints or angles that can't be made.
import { contactBetween, TOUCH_TOL } from './contact'
import { AXES, boxInLocal, isAxisAligned, overlap1, worldBox } from './geometry'
import { validateBoard, validateJoint } from './joints'
import type { GrooveParams, Joint, Project } from './types'
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

export function validate(project: Project): Warning[] {
  const warnings: Warning[] = []

  const joined = new Set(project.joints.flatMap(j => [`${j.hostBoardId}|${j.partnerBoardId}`, `${j.partnerBoardId}|${j.hostBoardId}`]))
  const boards = project.boards.filter(isAxisAligned)
  for (let i = 0; i < boards.length; i++) {
    for (let k = i + 1; k < boards.length; k++) {
      const a = boards[i]
      const b = boards[k]
      if (joined.has(`${a.id}|${b.id}`)) continue
      const A = worldBox(a)
      const B = worldBox(b)
      if (AXES.every(ax => overlap1(A.min[ax], A.max[ax], B.min[ax], B.max[ax]) > TOUCH_TOL)) {
        warnings.push({ kind: 'overlap', boardIds: [a.id, b.id], message: `${a.name} and ${b.name} overlap` })
      }
    }
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
    if ((!own && !contactBetween(project, j.hostBoardId, j.partnerBoardId)) || !seatedInGroove(project, j)) {
      const name = (id: string) => project.boards.find(b => b.id === id)?.name ?? '?'
      warnings.push({
        kind: 'badJoint',
        boardIds: [j.hostBoardId, j.partnerBoardId],
        message: `The ${NAMES[j.type]} joint between ${name(j.hostBoardId)} and ${name(j.partnerBoardId)} no longer lines up — move them back together or remove the joint`
      })
      continue
    }
    // A shaped part may have been cut away right where the joint is.
    const host = project.boards.find(b => b.id === j.hostBoardId)!
    const partner = project.boards.find(b => b.id === j.partnerBoardId)!
    for (const [s, o] of [[host, partner], [partner, host]]) {
      if (s.outline && !shapeReaches(project, s, o)) {
        warnings.push({ kind: 'badJoint', boardIds: [s.id, o.id], message: `The shape of ${s.name} doesn't reach where it joins ${o.name}` })
      }
    }
  }
  return warnings
}

/** For a dado or rabbet: the partner board still sits inside the groove (not just somewhere on the host's face). */
function seatedInGroove(project: Project, j: Joint): boolean {
  if (j.type !== 'dado' && j.type !== 'rabbet') return true
  const host = project.boards.find(b => b.id === j.hostBoardId)
  const partner = project.boards.find(b => b.id === j.partnerBoardId)
  if (!host || !partner || !isAxisAligned(host) || !isAxisAligned(partner)) return true
  const p = j.params as GrooveParams
  if (p.standalone) return true
  const local = boxInLocal(host, worldBox(partner))
  // An edge groove: the partner reaches into it no further than its depth.
  if (p.face === 'left') return local.max.x <= p.depth + TOUCH_TOL
  if (p.face === 'right') return local.min.x >= host.width - p.depth - TOUCH_TOL
  const ax = (p.along ?? 'width') === 'width' ? 'y' : 'x'
  return local.min[ax] >= p.offset - TOUCH_TOL && local.max[ax] <= p.offset + p.width + TOUCH_TOL
}
