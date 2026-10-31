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
  // A groove running along the part (a box or drawer bottom's groove) lets the panel in it float.
  if (j.type === 'dado' || j.type === 'rabbet') return !pr.standalone && !isEdgeGroove(pr) && pr.along !== 'length'
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

/** The world axis a part moves along with the seasons (across its grain), and how big it is that way. */
function acrossGrain(b: Board): { axis: 'x' | 'y' | 'z'; size: number } {
  const ax = localAxes(b)
  return b.grain === 'width' ? { axis: ax.length.axis, size: b.length } : { axis: ax.width.axis, size: b.width }
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
      const xg = acrossGrain(X)
      if (warned.has(X.id) || xg.size <= 3) continue
      // Y holds X rigidly when Y's grain (which hardly moves) runs the way X moves.
      const yAlong = Y.grain === 'width' ? localAxes(Y).width.axis : localAxes(Y).length.axis
      if (yAlong !== xg.axis) continue
      // They must actually share more than 3" along that direction.
      const bx = worldBox(X), by = worldBox(Y)
      if (Math.min(bx.max[xg.axis], by.max[xg.axis]) - Math.max(bx.min[xg.axis], by.min[xg.axis]) <= 3) continue
      const m = movement(xg.size, speciesOfBoard(p, X), SEASON.from, SEASON.to, 'flat').inches
      // Small movement is taken up by the glue and the wood; from about 3/16" it cracks joints or the part.
      if (m < MOVE_LIMIT) continue
      warned.add(X.id)
      out.push({
        kind: 'crossGrain', boardIds: [X.id, Y.id],
        message: `Cross-grain: ${X.name} will move about ${formatInches(m)} across its ${formatInches(xg.size)} width with the seasons, but ${Y.name} holds it rigidly along its length. Use buttons, figure-8s or slotted holes, or let it float.`,
        link: { page: 'movement', width: xg.size, speciesId: speciesOfBoard(p, X).id }
      })
    }
  }
  return out
}

/**
 * Shelves that will sag: flat parts at least 5" deep, held at their ends by upright parts, with no part
 * running along under or behind them (an apron, a back, a base) to carry them. The span checked is the
 * longest gap between supports (a centre divider halves it). Identical shelves get one warning.
 */
export function sagWarnings(p: Project): Warning[] {
  const out: Warning[] = []
  const byId = new Map(p.boards.map(b => [b.id, b]))
  const joints = new Map<string, Board[]>()
  for (const j of p.joints) {
    const a = byId.get(j.hostBoardId), b = byId.get(j.partnerBoardId)
    if (!a || !b) continue
    joints.set(a.id, [...(joints.get(a.id) ?? []), b])
    joints.set(b.id, [...(joints.get(b.id) ?? []), a])
  }
  const seen = new Map<string, Warning>()
  for (const b of p.boards) {
    if (b.length <= 24 || b.width < 5) continue
    const ax = localAxes(b)
    if (ax.thickness.axis !== 'z') continue
    const L = ax.length.axis
    const others = joints.get(b.id) ?? []
    // Carried along its length (aprons, a back, a base): it can't sag like a shelf.
    if (others.some(o => localAxes(o).length.axis === L)) continue
    const ups = others.filter(o => localAxes(o).thickness.axis === L)
    if (ups.length < 2) continue
    const bb = worldBox(b)
    const at = [...new Set(ups.map(o => { const w = worldBox(o); return (w.min[L] + w.max[L]) / 2 }))].sort((x, y) => x - y)
    const pts = [Math.max(bb.min[L], at[0]), ...at.slice(1, -1), Math.min(bb.max[L], at[at.length - 1])]
    const span = Math.max(...pts.slice(1).map((x, i) => x - pts[i]))
    if (span <= 24) continue
    const w = p.woods.find(x => x.id === b.woodId)
    if (!w) continue
    const st = stiffnessOf(w)
    // Solid wood is about 20 times less stiff across its grain.
    const moe = b.grain === 'width' && w.kind !== 'sheet' ? st.moe / 20 : st.moe
    const r = sag({ span, depth: b.width, thickness: b.thickness, moe, lbPerFt: BOOKS })
    if (r.ok) continue
    const key = `${w.id}|${span.toFixed(3)}|${b.width}|${b.thickness}|${b.grain}`
    const prev = seen.get(key)
    if (prev) { prev.boardIds.push(b.id); continue }
    const wn: Warning = {
      kind: 'sag', boardIds: [b.id],
      message: `Sag: loaded with books, ${b.name} (${formatInches(span)} span) will sag about ${formatInches(r.inches, { sixtyFourths: true })} — more than the ${formatInches(r.limit, { sixtyFourths: true })} most people notice. Use thicker or stiffer stock, add a front edge strip, or shorten the span.`,
      link: { page: 'sag', span, depth: b.width, thickness: b.thickness, moe, material: st.label }
    }
    seen.set(key, wn)
    out.push(wn)
  }
  // One line for a set of identical shelves.
  for (const wn of out) if (wn.boardIds.length > 1) wn.message = wn.message.replace(/^Sag: loaded with books, ([^(]+) \(/, (_m, n) => `Sag: loaded with books, ${n.trim()} and ${wn.boardIds.length - 1} like it (`)
  return out
}

export const libraryAdvice = (p: Project): Warning[] => [...crossGrainWarnings(p), ...sagWarnings(p)]
