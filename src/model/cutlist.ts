// The cut list: every part grouped, with sizes, notes, board feet, sheet counts and cost.
import { jointNotes } from './joints'
import { SHAPED_NOTE } from './shaped'
import { TURN_NOTE } from '../shaping/turning'
import { TAPER_NOTE, taperProblem } from '../shaping/taper'
import { profileRadii } from '../shaping/turning'
import { edgeNotes, edgeSignature } from '../shaping/edges'
import type { Board, GrooveParams, Project } from './types'
import { formatInches } from './units'
import { boardFeet, findWood } from './woods'

export type CutListRow = {
  qty: number
  part: string
  thickness: number
  width: number
  length: number
  woodName: string
  grain: 'length' | 'width'
  notes: string[]
}

export type CutListTotals = {
  boardFeetByWood: Record<string, number>
  sheetsByWood: Record<string, number>
  cost?: number
}

export const SHEET_AREA = 48 * 96

type Group = CutListRow & { woodId: string; names: string[]; base: string; canon: string; mirror: string }

// ---- Part shape, independent of how the part happens to be turned in the model ----
// The cuts on a board in its own coordinates. Two boards with the same cuts after turning one over or
// end-for-end are the same part in the shop; a board whose cuts match only in a mirror is its mirror twin.
type Features = {
  grooves: { type: string; along: 'width' | 'length'; a: number; b: number; depth: number; face: 'top' | 'bottom' | 'left' | 'right' }[]
  holes: { u: number; v: number; d: number; depth?: number; face?: 'top' | 'bottom' }[]
  ends: { start: { miter: number; bevel: number }; end: { miter: number; bevel: number } }
  edges: { left: number; right: number }
}

const r6 = (n: number) => Math.round(n * 1e6) / 1e6

function featuresOf(project: Project, b: Board): Features {
  const grooves = project.joints
    .filter(j => (j.type === 'dado' || j.type === 'rabbet') && j.hostBoardId === b.id)
    .map(j => {
      const p = j.params as GrooveParams
      return { type: j.type, along: p.along ?? 'width', a: p.offset, b: p.offset + p.width, depth: p.depth, face: p.face }
    })
  return {
    grooves,
    holes: b.holes.map(h => ({ u: h.u, v: h.v, d: h.diameter, ...(h.depth !== undefined ? { depth: h.depth, face: h.face ?? 'top' } : {}) })),
    ends: { start: { ...b.endCuts.start }, end: { ...b.endCuts.end } },
    edges: { ...b.edgeBevels }
  }
}

/** Mirror across the width (x → W−x), the length (y → L−y) or the thickness (z → T−z). */
function reflect(f: Features, axis: 'x' | 'y' | 'z', b: Board): Features {
  const W = b.width
  const L = b.length
  if (axis === 'x') {
    return {
      grooves: f.grooves.map(g => (g.face === 'left' || g.face === 'right' ? { ...g, face: g.face === 'left' ? 'right' : 'left' } : g.along === 'length' ? { ...g, a: W - g.b, b: W - g.a } : g)),
      holes: f.holes.map(h => ({ ...h, u: W - h.u })),
      ends: { start: { ...f.ends.start, miter: -f.ends.start.miter }, end: { ...f.ends.end, miter: -f.ends.end.miter } },
      edges: { left: f.edges.right, right: f.edges.left }
    }
  }
  if (axis === 'y') {
    return {
      grooves: f.grooves.map(g => (g.along === 'width' ? { ...g, a: L - g.b, b: L - g.a } : g)),
      holes: f.holes.map(h => ({ ...h, v: L - h.v })),
      ends: { start: f.ends.end, end: f.ends.start },
      edges: f.edges
    }
  }
  return {
    grooves: f.grooves.map(g => (g.face === 'left' || g.face === 'right' ? { ...g, a: b.thickness - g.b, b: b.thickness - g.a } : { ...g, face: g.face === 'top' ? 'bottom' : 'top' })),
    holes: f.holes.map(h => (h.face ? { ...h, face: h.face === 'top' ? 'bottom' : 'top' } : h)),
    ends: { start: { ...f.ends.start, bevel: -f.ends.start.bevel }, end: { ...f.ends.end, bevel: -f.ends.end.bevel } },
    edges: { left: -f.edges.left, right: -f.edges.right }
  }
}

function signature(f: Features): string {
  const grooves = f.grooves.map(g => [g.type, g.along, r6(g.a), r6(g.b), r6(g.depth), g.face].join(':')).sort()
  const holes = f.holes.map(h => [r6(h.u), r6(h.v), r6(h.d), h.depth === undefined ? '' : r6(h.depth), h.face ?? ''].join(':')).sort()
  const z = (n: number) => r6(n) || 0
  return JSON.stringify([grooves, holes, [f.ends.start.miter, f.ends.start.bevel, f.ends.end.miter, f.ends.end.bevel].map(z), [f.edges.left, f.edges.right].map(z)])
}

/** The same signature for every way the part can be turned over or end-for-end. */
function canonical(f: Features, b: Board): string {
  const turns = [f, reflect(reflect(f, 'x', b), 'y', b), reflect(reflect(f, 'y', b), 'z', b), reflect(reflect(f, 'x', b), 'z', b)]
  return turns.map(signature).sort()[0]
}

/** Fasteners driven into the part (butt nails, pocket screws) also make parts different. */
function fastenersOn(project: Project, b: Board): string[] {
  return project.joints
    .filter(j => j.partnerBoardId === b.id && (j.type === 'butt' || j.type === 'pocketScrew'))
    .map(j => JSON.stringify([j.type, j.params]))
    .sort()
}

/** A turned leg as the shop sees it: its pommel, foot and the shape of its profile (not which drawing holds it). */
function turningSignature(project: Project, b: Board): unknown {
  const t = b.turning
  if (!t) return null
  const radii = profileRadii(project, b)
  const shape = radii ? radii.filter((_, i) => i % 8 === 0 || i === radii.length - 1).map(q => [r6(Math.round(q.x * 64) / 64), Math.round(q.r * 128) / 128]) : t.sketchId
  return [t.top, t.bottom, t.shoulder, shape]
}

/** A taper as the shop sees it: how many faces on each axis (on a square leg the axes are the same), start and foot. */
function taperSignature(b: Board): unknown {
  const t = b.taper
  if (!t) return null
  const w = t.faces.filter(f => f === 'left' || f === 'right').length
  const th = t.faces.length - w
  const axes = Math.abs(b.width - b.thickness) < 1e-9 ? [w, th].sort() : [w, th]
  return [axes, t.start, t.foot]
}

export function cutList(project: Project): { rows: CutListRow[]; totals: CutListTotals } {
  const groups = new Map<string, Group>()
  for (const b of project.boards) {
    const f = featuresOf(project, b)
    const base = JSON.stringify([b.woodId, b.thickness, b.width, b.length, b.grain, fastenersOn(project, b), b.outline ?? null, turningSignature(project, b), taperSignature(b), edgeSignature(b)])
    const canon = canonical(f, b)
    const key = JSON.stringify([base, canon])
    const g = groups.get(key)
    if (g) {
      g.qty += 1
      if (!g.names.includes(b.name)) g.names.push(b.name)
    } else {
      const wood = findWood(project, b.woodId)
      groups.set(key, {
        qty: 1, part: '', thickness: b.thickness, width: b.width, length: b.length,
        woodName: wood?.name ?? 'Unknown wood', grain: b.grain, notes: [...(b.outline ? [SHAPED_NOTE] : []), ...(b.turning ? [TURN_NOTE(b.turning)] : []), ...(b.taper && !b.turning && !taperProblem(b, b.taper) ? [TAPER_NOTE(b, b.taper)] : []), ...edgeNotes(b), ...jointNotes(project, b.id)], woodId: b.woodId, names: [b.name],
        base, canon, mirror: canonical(reflect(f, 'z', b), b)
      })
    }
  }
  const all = [...groups.values()]
  // A part that isn't its own mirror image, next to a part that is exactly that mirror image: a mirror pair.
  for (const g of all) {
    if (g.mirror === g.canon) continue
    const twin = all.find(o => o !== g && o.base === g.base && o.canon === g.mirror)
    if (twin) g.notes = [...g.notes, `Mirror pair with the other ${twin.names.join(' / ')} — grooves on the opposite face`]
  }
  all.sort((a, b) => a.woodName.localeCompare(b.woodName) || b.thickness - a.thickness || b.length - a.length)

  const boardFeetByWood: Record<string, number> = {}
  const areaByWood: Record<string, number> = {}
  const usedWoodIds = new Set<string>()
  for (const g of all) {
    usedWoodIds.add(g.woodId)
    const wood = findWood(project, g.woodId)
    if (wood?.kind === 'sheet') areaByWood[g.woodName] = (areaByWood[g.woodName] ?? 0) + g.width * g.length * g.qty
    else boardFeetByWood[g.woodName] = (boardFeetByWood[g.woodName] ?? 0) + boardFeet(g.thickness, g.width, g.length) * g.qty
  }
  const sheetsByWood: Record<string, number> = {}
  for (const [name, area] of Object.entries(areaByWood)) sheetsByWood[name] = Math.ceil(area / SHEET_AREA - 1e-9)

  let cost: number | undefined = 0
  for (const id of usedWoodIds) {
    const wood = findWood(project, id)
    if (!wood) { cost = undefined; break }
    if (wood.kind === 'sheet') {
      if (wood.pricePerSheet === undefined) { cost = undefined; break }
      cost += wood.pricePerSheet * (sheetsByWood[wood.name] ?? 0)
    } else {
      if (wood.pricePerBoardFoot === undefined) { cost = undefined; break }
      cost += wood.pricePerBoardFoot * (boardFeetByWood[wood.name] ?? 0)
    }
  }
  if (all.length === 0) cost = undefined

  const rows: CutListRow[] = all.map(({ woodId: _w, names, base: _b, canon: _c, mirror: _m, ...r }) => ({ ...r, part: names.join(' / ') }))
  const totals: CutListTotals = { boardFeetByWood, sheetsByWood }
  if (cost !== undefined) totals.cost = Math.round(cost * 100) / 100
  return { rows, totals }
}

function csvField(v: string | number): string {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function cutListCsv(project: Project): string {
  const lines = ['Qty,Part,Thickness,Width,Length,Wood,Grain,Notes']
  for (const r of cutList(project).rows) {
    lines.push(
      [r.qty, r.part, formatInches(r.thickness), formatInches(r.width), formatInches(r.length), r.woodName, r.grain, r.notes.join('; ')]
        .map(csvField)
        .join(',')
    )
  }
  return lines.join('\n') + '\n'
}
