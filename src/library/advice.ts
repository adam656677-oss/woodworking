// Designer advice from the Deep Library: solid wood glued cross-grain, and shelves that will sag.
import { localAxes, worldBox } from '../model/geometry'
import type { Warning } from '../model/validate'
import { formatInches } from '../model/units'
import type { Board, Joint, Project } from '../model/types'
import { isEdgeGroove } from '../model/types'
import { movement, sag, stiffnessOf } from './calc'
import { findSpecies, speciesById } from './species'

/** Seasonal swing the warnings plan for: dry winter indoors to humid summer. */
export const SEASON = { from: 6, to: 12 }
const BOOKS = 20
/** Seasonal movement worth a warning when the joint is rigid. */
export const MOVE_LIMIT = 3 / 16 - 1 / 128

/** Joints that hold two parts rigidly (a groove in an edge or a stand-alone cut lets a panel float, so not those). */
function rigid(j: Joint): boolean {
  const pr = j.params as any
  if (j.type === 'dado' || j.type === 'rabbet') return !pr.standalone && !isEdgeGroove(pr)
  if (j.type === 'butt') return pr.fastener === 'glue' || pr.fastener === 'screws'
  if (j.type === 'miter') return pr.fastener !== 'nails'
  return j.type === 'pocketScrew'
}

const solid = (p: Project, b: Board) => p.woods.find(w => w.id === b.woodId)?.kind !== 'sheet'
/** The species of a part's wood (or red oak, a typical hardwood, when the wood names none we know). */
export function speciesOfBoard(p: Project, b: Board) {
  const w = p.woods.find(x => x.id === b.woodId)
  return (w && (findSpecies(w.species) ?? findSpecies(w.name))) ?? speciesById(w?.kind === 'lumber' ? 'eastern-white-pine' : 'red-oak')!
}

export function crossGrainWarnings(p: Project): Warning[] {
  const out: Warning[] = []
  const warned = new Set<string>()
  const byId = new Map(p.boards.map(b => [b.id, b]))
  for (const j of p.joints) {
    if (!rigid(j)) continue
    const A = byId.get(j.hostBoardId), B = byId.get(j.partnerBoardId)
    if (!A || !B || !solid(p, A) || !solid(p, B)) continue
    for (const [X, Y] of [[A, B], [B, A]] as const) {
      if (warned.has(X.id) || X.width <= 3) continue
      const across = localAxes(X).width.axis
      if (localAxes(Y).length.axis !== across) continue
      // They must actually share more than 3" along that direction.
      const bx = worldBox(X), by = worldBox(Y)
      if (Math.min(bx.max[across], by.max[across]) - Math.max(bx.min[across], by.min[across]) <= 3) continue
      const m = movement(X.width, speciesOfBoard(p, X), SEASON.from, SEASON.to, 'flat').inches
      // Small movement is taken up by the glue and the wood; from about 3/16" it cracks joints or the part.
      if (m < MOVE_LIMIT) continue
      warned.add(X.id)
      out.push({
        kind: 'crossGrain', boardIds: [X.id, Y.id],
        message: `Cross-grain: ${X.name} will move about ${formatInches(m)} across its ${formatInches(X.width)} width with the seasons, but ${Y.name} holds it rigidly along its length. Use buttons, figure-8s or slotted holes, or let it float.`,
        link: { page: 'movement', width: X.width, speciesId: speciesOfBoard(p, X).id }
      })
    }
  }
  return out
}

export function sagWarnings(p: Project): Warning[] {
  const out: Warning[] = []
  const byId = new Map(p.boards.map(b => [b.id, b]))
  for (const b of p.boards) {
    if (b.length <= 24 || b.width < 3) continue
    const ax = localAxes(b)
    if (ax.thickness.axis !== 'z') continue
    // Supported at both ends by upright parts it's joined to.
    const ups = new Set<string>()
    for (const j of p.joints) {
      const other = j.hostBoardId === b.id ? byId.get(j.partnerBoardId) : j.partnerBoardId === b.id ? byId.get(j.hostBoardId) : undefined
      if (other && localAxes(other).thickness.axis !== 'z' && localAxes(other).thickness.axis === ax.length.axis) ups.add(other.id)
    }
    if (ups.size < 2) continue
    const w = p.woods.find(x => x.id === b.woodId)
    if (!w) continue
    const st = stiffnessOf(w)
    const r = sag({ span: b.length, depth: b.width, thickness: b.thickness, moe: st.moe, lbPerFt: BOOKS })
    if (r.ok) continue
    out.push({
      kind: 'sag', boardIds: [b.id],
      message: `Sag: loaded with books, ${b.name} (${formatInches(b.length)} span) will sag about ${formatInches(r.inches, { sixtyFourths: true })} — more than the ${formatInches(r.limit, { sixtyFourths: true })} most people notice. Use thicker or stiffer stock, add a front edge strip, or shorten the span.`,
      link: { page: 'sag', span: b.length, depth: b.width, thickness: b.thickness, moe: st.moe, material: st.label }
    })
  }
  return out
}

export const libraryAdvice = (p: Project): Warning[] => [...crossGrainWarnings(p), ...sagWarnings(p)]
