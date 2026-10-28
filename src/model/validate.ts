// Design warnings: overlapping boards, parts bigger than the stock, and joints or angles that can't be made.
import { contactBetween, TOUCH_TOL } from './contact'
import { AXES, boxInLocal, isAxisAligned, overlap1, worldBox } from './geometry'
import { validateBoard, validateJoint } from './joints'
import type { GrooveParams, Joint, Project } from './types'
import { formatInches } from './units'
import { findWood } from './woods'

export type Warning = { kind: 'overlap' | 'exceedsStock' | 'badJoint'; boardIds: string[]; message: string }

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
    const angleProblem = validateBoard(b)
    if (angleProblem) warnings.push({ kind: 'badJoint', boardIds: [b.id], message: angleProblem })
  }

  const NAMES: Record<string, string> = { butt: 'butt', dado: 'dado', rabbet: 'rabbet', pocketScrew: 'pocket-screw', miter: 'miter' }
  for (const j of project.joints) {
    const reason = validateJoint(project, j)
    if (reason) {
      warnings.push({ kind: 'badJoint', boardIds: [j.hostBoardId, j.partnerBoardId], message: reason })
      continue
    }
    // A joint only means something while its boards still meet the way it describes.
    if (!contactBetween(project, j.hostBoardId, j.partnerBoardId) || !seatedInGroove(project, j)) {
      const name = (id: string) => project.boards.find(b => b.id === id)?.name ?? '?'
      warnings.push({
        kind: 'badJoint',
        boardIds: [j.hostBoardId, j.partnerBoardId],
        message: `The ${NAMES[j.type]} joint between ${name(j.hostBoardId)} and ${name(j.partnerBoardId)} no longer lines up — move them back together or remove the joint`
      })
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
  const local = boxInLocal(host, worldBox(partner))
  const ax = (p.along ?? 'width') === 'width' ? 'y' : 'x'
  return local.min[ax] >= p.offset - TOUCH_TOL && local.max[ax] <= p.offset + p.width + TOUCH_TOL
}
