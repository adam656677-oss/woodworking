// Snapping the pointer to what's already drawn: ends, middles, centres and quadrants, crossings, tangent and
// perpendicular points, a point on a shape, a 15° angle step from where the line started, then the grid.
import { arcAngles, pointOf } from './geometry'
import { intersectPrims, nearestOn, onArc, primOf } from './intersect'
import type { Pt, Sketch } from './types'

export type SnapKind = 'endpoint' | 'midpoint' | 'center' | 'quadrant' | 'intersection' | 'tangent' | 'perpendicular' | 'nearest' | 'angle' | 'grid' | 'none'
/** `angle` is the step's angle in degrees, for an angle snap. */
export type Snap = { pt: Pt; kind: SnapKind; ref?: string; angle?: number }

/** Angle steps, in degrees, that a line being drawn locks to (like polar tracking). */
export const ANGLE_STEP = 15
const ANGLE_TOL = 1.5

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
  // Quadrants: the top, bottom, left and right of circles and arcs.
  for (const e of ents) {
    if (e.kind !== 'circle' && e.kind !== 'arc') continue
    const p = primOf(sk, e)
    if (!p || (p.type !== 'circle' && p.type !== 'arc')) continue
    for (let k = 0; k < 4; k++) {
      const pt = { x: p.c.x + p.r * Math.cos((k * Math.PI) / 2), y: p.c.y + p.r * Math.sin((k * Math.PI) / 2) }
      if (p.type === 'circle' || onArc(p, pt)) mids.push({ pt, kind: 'quadrant' })
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
    // Perpendicular: where a line from the start point meets a line (or a circle) square.
    const perps: Snap[] = []
    for (const p of prims) {
      if (p.type === 'seg') {
        const dx = p.b.x - p.a.x, dy = p.b.y - p.a.y, l2 = dx * dx + dy * dy
        if (!l2) continue
        const u = ((f.x - p.a.x) * dx + (f.y - p.a.y) * dy) / l2
        if (u < -1e-9 || u > 1 + 1e-9) continue
        const pt = { x: p.a.x + u * dx, y: p.a.y + u * dy }
        if (dist(pt, f) > 1e-6) perps.push({ pt, kind: 'perpendicular' })
      } else if (p.type === 'circle' || p.type === 'arc') {
        const d = dist(f, p.c)
        if (d < 1e-9) continue
        for (const s of [1, -1]) {
          const pt = { x: p.c.x + (s * p.r * (f.x - p.c.x)) / d, y: p.c.y + (s * p.r * (f.y - p.c.y)) / d }
          if (p.type === 'circle' || onArc(p, pt)) perps.push({ pt, kind: 'perpendicular' })
        }
      }
    }
    const pp = best(perps)
    if (pp) return pp
  }

  // A point on a shape (only very close, so the grid still wins in open space).
  const near: Snap[] = []
  for (const p of prims) { const n = nearestOn(p, q); if (n.d <= tol / 2) near.push({ pt: n.p, kind: 'nearest' }) }
  const nr = best(near)
  if (nr) return nr

  // An angle step from the start point: the grid point if it's already on the step, else the pointer's distance
  // (to 1/64") along the step.
  if (opts.from) {
    const f = opts.from
    const g = opts.grid ? { x: Math.round(q.x / opts.grid) * opts.grid, y: Math.round(q.y / opts.grid) * opts.grid } : q
    const deg = (Math.atan2(q.y - f.y, q.x - f.x) * 180) / Math.PI
    const step = Math.round(deg / ANGLE_STEP) * ANGLE_STEP
    const len = dist(q, f)
    if (len > tol && Math.abs(deg - step) <= ANGLE_TOL) {
      const gDeg = (Math.atan2(g.y - f.y, g.x - f.x) * 180) / Math.PI
      if (dist(g, f) > 1e-9 && Math.abs(gDeg - step) < 1e-6) return { pt: g, kind: opts.grid ? 'grid' : 'angle', ...(opts.grid ? {} : { angle: step }) }
      const r = (step * Math.PI) / 180
      const L = Math.round(len * 64) / 64
      return { pt: { x: f.x + L * Math.cos(r), y: f.y + L * Math.sin(r) }, kind: 'angle', angle: ((step % 360) + 360) % 360 }
    }
  }

  if (opts.grid) {
    const g = opts.grid
    return { pt: { x: Math.round(q.x / g) * g, y: Math.round(q.y / g) * g }, kind: 'grid' }
  }
  return { pt: q, kind: 'none' }
}
