// Design warnings: overlapping boards, parts bigger than the stock, and joints or angles that can't be made.
import { TOUCH_TOL } from './contact'
import { AXES, isAxisAligned, overlap1, worldBox } from './geometry'
import { validateBoard, validateJoint } from './joints'
import type { Project } from './types'
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

  for (const j of project.joints) {
    const reason = validateJoint(project, j)
    if (reason) warnings.push({ kind: 'badJoint', boardIds: [j.hostBoardId, j.partnerBoardId], message: reason })
  }
  return warnings
}
