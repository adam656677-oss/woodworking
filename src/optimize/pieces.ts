// What has to be cut: each part as a piece with its cut size, part number and grain.
import { ancestry } from '../assemblies/ops'
import { cutList } from '../model/cutlist'
import type { Project } from '../model/types'
import { cutSize } from './banding'
import { settingsFor } from './settings'

export type Piece = {
  boardId: string
  /** P1, P2… in cut-list order (the same for every part in one row). */
  no: number
  name: string
  woodId: string
  thickness: number
  /** Cut size: across (width) and along the grain (length), with any allowance. */
  w: number
  l: number
  /** Must keep its length along the stock's length. */
  grain: boolean
  /** Parts that must come from one sheet or board (a group marked "Cut from one sheet"). */
  together?: string
}

/** Part numbers by part: P-number of each part's cut-list row. */
export function partNumbers(p: Project): Map<string, number> {
  const m = new Map<string, number>()
  cutList(p).rows.forEach((r, i) => r.boardIds.forEach(id => m.set(id, i + 1)))
  return m
}

export function piecesOf(p: Project): Piece[] {
  const nos = partNumbers(p)
  const out: Piece[] = []
  for (const b of p.boards) {
    const wood = p.woods.find(w => w.id === b.woodId)
    if (!wood) continue
    const s = settingsFor(p, wood)
    const c = cutSize(b)
    // Sheet goods have grain unless they're MDF (or the part's grain runs across); lumber always does.
    const grain = wood.kind !== 'sheet' || !/mdf|particle|hardboard|melamine/i.test(`${wood.species} ${wood.name}`)
    const gw = b.grain === 'width' ? c.length : c.width
    const gl = b.grain === 'width' ? c.width : c.length
    const together = [...ancestry(p, b.groupId)].reverse().find(g => g.oneSheet)?.id
    out.push({ boardId: b.id, no: nos.get(b.id) ?? 0, name: b.name, woodId: wood.id, thickness: b.thickness, w: gw, l: gl + s.allowance, grain, ...(together ? { together } : {}) })
  }
  return out
}
