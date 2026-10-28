// The Simple Designer's limits and its kid-friendly warning sentences.
import type { Project } from '../model/types'
import { formatInches } from '../model/units'
import type { Warning } from '../model/validate'
import { findWood } from '../model/woods'

/** Woods offered in the Simple Designer: standard 1x boards and two plywoods. */
export const KID_WOODS = ['1x2', '1x3', '1x4', '1x6', '1x8', '1x10', '1x12', 'ply-1-2', 'ply-3-4']

/** Kids' sizes go to the nearest 1/8" (and are never smaller than 1/8"). */
export function round8(n: number): number {
  return Math.max(0.125, Math.round(n * 8) / 8)
}

/** The same warning, said the way a kid would understand it. */
export function kidMessage(w: Warning, project: Project): string {
  const board = (i: number) => project.boards.find(b => b.id === w.boardIds[i])
  const a = board(0)
  if (w.kind === 'overlap' && a && board(1)) return `${a.name} and ${board(1)!.name} are bumping into each other — move one`
  if (w.kind === 'exceedsStock' && a) {
    const wood = findWood(project, a.woodId)
    if (wood && a.length > wood.length) return `${a.name} is longer than the longest board you can buy (${formatInches(wood.length)}) — make it shorter`
    if (wood && a.width > wood.width) return `${a.name} is wider than a ${wood.name} board — make it narrower or pick a wider board`
  }
  return w.message
}
