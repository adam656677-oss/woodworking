// Snapping the pointer to what's already drawn: ends, middles, centres, crossings, tangent points, then the grid.
import { arcAngles, pointOf } from './geometry'
import { intersectPrims, onArc, primOf } from './intersect'
import type { Pt, Sketch } from './types'

export type SnapKind = 'endpoint' | 'midpoint' | 'center' | 'intersection' | 'tangent' | 'grid' | 'none'
export type Snap = { pt: Pt; kind: SnapKind; ref?: string }

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y)

/**
 * The best snap near `q` within `tol` inches. `from` is where the line being drawn starts (for tangent snaps);
 * `grid` is the grid spacing, if the grid is on. Ends win over middles and centres, then crossings, tangents, the grid.
 */
export function snapTo(sk: Sketch, q: Pt, opts: { tol: number; grid?: number; from?: Pt; ignore?: string[] }): Snap {
  const { tol } = opts
  const ignore = new Set(opts.ignore ?? [])
  const ents = sk.entities.filter(e => !ignore.has(e.id))
  const best = (cands: Snap[]): Snap | null => {
    let b: Snap | null = null, bd = tol
    for (const c of cands) {
      const d = dist(c.pt, q)
      if (d <= bd) { b = c; bd = d }
    }
    return b
  }
  const P = (id: string) => pointOf(sk, id)

  const ends: Snap[] = []
  for (const e of ents) {
    const ids = e.kind === 'line' ? [e.a, e.b] : e.kind === 'arc' ? [e.start, e.end] : e.kind === 'spline' ? [e.points[0], e.points[e.points.length - 1]] : []
    for (const id of ids) if (!ignore.has(id)) ends.push({ pt: P(id), kind: 'endpoint', ref: id })
  }
  // Loose points (not part of a shape yet) count as ends too.
  const inShapes = new Set(ents.flatMap(e => (e.kind === 'line' ? [e.a, e.b] : e.kind === 'arc' ? [e.center, e.start, e.end] : e.kind === 'circle' ? [e.center] : e.kind === 'spline' ? e.points : [e.at])))
  for (const p of sk.points) if (!inShapes.has(p.id) && !ignore.has(p.id)) ends.push({ pt: { x: p.x, y: p.y }, kind: 'endpoint', ref: p.id })
  const hit = best(ends)
  if (hit) return hit

  const mids: Snap[] = []
  for (const e of ents) {
    if (e.kind === 'line') {
      const a = P(e.a), b = P(e.b)
      mids.push({ pt: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, kind: 'midpoint' })
    } else if (e.kind === 'arc') {
      const c = P(e.center)
      const { a0, sweep, r } = arcAngles(c, P(e.start), P(e.end))
      mids.push({ pt: { x: c.x + r * Math.cos(a0 + sweep / 2), y: c.y + r * Math.sin(a0 + sweep / 2) }, kind: 'midpoint' })
      mids.push({ pt: c, kind: 'center', ref: e.center })
    } else if (e.kind === 'circle') {
      mids.push({ pt: P(e.center), kind: 'center', ref: e.center })
    }
  }
  const mid = best(mids)
  if (mid) return mid

  const prims = ents.flatMap(e => { const p = primOf(sk, e); return p ? [p] : [] })
  const crossings: Snap[] = []
  for (let i = 0; i < prims.length; i++) for (let k = i + 1; k < prims.length; k++) {
    for (const pt of intersectPrims(prims[i], prims[k])) crossings.push({ pt, kind: 'intersection' })
  }
  const x = best(crossings)
  if (x) return x

  if (opts.from) {
    const f = opts.from
    const tans: Snap[] = []
    for (const p of prims) {
      if (p.type !== 'arc' && p.type !== 'circle') continue
      const d = dist(f, p.c)
      if (d <= p.r) continue
      const base = Math.atan2(f.y - p.c.y, f.x - p.c.x)
      const off = Math.acos(p.r / d)
      for (const a of [base + off, base - off]) {
        const pt = { x: p.c.x + p.r * Math.cos(a), y: p.c.y + p.r * Math.sin(a) }
        if (p.type === 'circle' || onArc(p, pt)) tans.push({ pt, kind: 'tangent' })
      }
    }
    const t = best(tans)
    if (t) return t
  }

  if (opts.grid) {
    const g = opts.grid
    return { pt: { x: Math.round(q.x / g) * g, y: Math.round(q.y / g) * g }, kind: 'grid' }
  }
  return { pt: q, kind: 'none' }
}
