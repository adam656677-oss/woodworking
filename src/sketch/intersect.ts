// Where shapes cross: used by snapping, trim and extend.
import { arcAngles, pointOf, tessellateEntity } from './geometry'
import type { Pt, Sketch, SketchEntity } from './types'

export type Prim =
  | { type: 'seg'; a: Pt; b: Pt }
  | { type: 'arc'; c: Pt; r: number; a0: number; sweep: number }
  | { type: 'circle'; c: Pt; r: number }
  | { type: 'poly'; pts: Pt[] }

export function primOf(sk: Sketch, e: SketchEntity): Prim | null {
  const P = (id: string) => pointOf(sk, id)
  switch (e.kind) {
    case 'line': return { type: 'seg', a: P(e.a), b: P(e.b) }
    case 'arc': {
      const c = P(e.center)
      const { a0, sweep, r } = arcAngles(c, P(e.start), P(e.end))
      return { type: 'arc', c, r, a0, sweep }
    }
    case 'circle': return { type: 'circle', c: P(e.center), r: e.r }
    case 'spline': return { type: 'poly', pts: tessellateEntity(sk, e, 1 / 16) }
    case 'text': return null
  }
}

const EPS = 1e-9
const TAU = 2 * Math.PI

/** Angle of q around c, measured from a0 counter-clockwise, in [0, 2π). */
export function angleFrom(c: Pt, q: Pt, a0: number): number {
  let d = Math.atan2(q.y - c.y, q.x - c.x) - a0
  while (d < 0) d += TAU
  while (d >= TAU) d -= TAU
  return d
}

export const onArc = (p: { c: Pt; a0: number; sweep: number }, q: Pt) => {
  const d = angleFrom(p.c, q, p.a0)
  return d <= p.sweep + 1e-7 || d >= TAU - 1e-7
}

/** Line (a→b, as a whole infinite line) against a circle: points with their t along a→b. */
export function lineCircle(a: Pt, b: Pt, c: Pt, r: number): { t: number; p: Pt }[] {
  const dx = b.x - a.x, dy = b.y - a.y
  const fx = a.x - c.x, fy = a.y - c.y
  const A = dx * dx + dy * dy
  if (A < EPS) return []
  const B = 2 * (fx * dx + fy * dy)
  const C = fx * fx + fy * fy - r * r
  const disc = B * B - 4 * A * C
  if (disc < -1e-12) return []
  const s = Math.sqrt(Math.max(0, disc))
  const ts = disc <= 1e-12 ? [-B / (2 * A)] : [(-B - s) / (2 * A), (-B + s) / (2 * A)]
  return ts.map(t => ({ t, p: { x: a.x + t * dx, y: a.y + t * dy } }))
}

/** Two infinite lines: t along a→b and u along c→d, or null if parallel. */
export function lineLine(a: Pt, b: Pt, c: Pt, d: Pt): { t: number; u: number; p: Pt } | null {
  const r = { x: b.x - a.x, y: b.y - a.y }, s = { x: d.x - c.x, y: d.y - c.y }
  const den = r.x * s.y - r.y * s.x
  if (Math.abs(den) < 1e-12) return null
  const t = ((c.x - a.x) * s.y - (c.y - a.y) * s.x) / den
  const u = ((c.x - a.x) * r.y - (c.y - a.y) * r.x) / den
  return { t, u, p: { x: a.x + t * r.x, y: a.y + t * r.y } }
}

export function circleCircle(c1: Pt, r1: number, c2: Pt, r2: number): Pt[] {
  const d = Math.hypot(c2.x - c1.x, c2.y - c1.y)
  if (d < EPS || d > r1 + r2 + 1e-9 || d < Math.abs(r1 - r2) - 1e-9) return []
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d)
  const h = Math.sqrt(Math.max(0, r1 * r1 - a * a))
  const mx = c1.x + (a * (c2.x - c1.x)) / d, my = c1.y + (a * (c2.y - c1.y)) / d
  if (h < 1e-9) return [{ x: mx, y: my }]
  return [
    { x: mx + (h * (c2.y - c1.y)) / d, y: my - (h * (c2.x - c1.x)) / d },
    { x: mx - (h * (c2.y - c1.y)) / d, y: my + (h * (c2.x - c1.x)) / d }
  ]
}

const segs = (p: Prim): { a: Pt; b: Pt }[] =>
  p.type === 'seg' ? [{ a: p.a, b: p.b }] : p.type === 'poly' ? p.pts.slice(1).map((b, i) => ({ a: p.pts[i], b })) : []
const round = (p: Prim): { c: Pt; r: number; a0: number; sweep: number } | null =>
  p.type === 'arc' ? p : p.type === 'circle' ? { c: p.c, r: p.r, a0: 0, sweep: TAU } : null

/** Where two shapes actually cross (within their extents). */
export function intersectPrims(p: Prim, q: Prim): Pt[] {
  const out: Pt[] = []
  const rp = round(p), rq = round(q)
  if (rp && rq) {
    for (const x of circleCircle(rp.c, rp.r, rq.c, rq.r)) if (onArc(rp, x) && onArc(rq, x)) out.push(x)
    return out
  }
  if (rp || rq) {
    const r = (rp ?? rq)!
    for (const s of segs(rp ? q : p)) for (const x of lineCircle(s.a, s.b, r.c, r.r)) if (x.t >= -1e-9 && x.t <= 1 + 1e-9 && onArc(r, x.p)) out.push(x.p)
    return out
  }
  for (const s of segs(p)) for (const t of segs(q)) {
    const x = lineLine(s.a, s.b, t.a, t.b)
    if (x && x.t >= -1e-9 && x.t <= 1 + 1e-9 && x.u >= -1e-9 && x.u <= 1 + 1e-9) out.push(x.p)
  }
  return out
}

export function intersections(sk: Sketch, aId: string, bId: string): Pt[] {
  const a = sk.entities.find(e => e.id === aId), b = sk.entities.find(e => e.id === bId)
  if (!a || !b) return []
  const pa = primOf(sk, a), pb = primOf(sk, b)
  return pa && pb ? intersectPrims(pa, pb) : []
}

/** Closest point on a shape to q, and how far it is. */
export function nearestOn(p: Prim, q: Pt): { p: Pt; d: number } {
  const r = round(p)
  if (r) {
    const a = Math.atan2(q.y - r.c.y, q.x - r.c.x)
    let best = { x: r.c.x + r.r * Math.cos(a), y: r.c.y + r.r * Math.sin(a) }
    if (!onArc(r, best)) {
      const s = { x: r.c.x + r.r * Math.cos(r.a0), y: r.c.y + r.r * Math.sin(r.a0) }
      const e = { x: r.c.x + r.r * Math.cos(r.a0 + r.sweep), y: r.c.y + r.r * Math.sin(r.a0 + r.sweep) }
      best = Math.hypot(s.x - q.x, s.y - q.y) < Math.hypot(e.x - q.x, e.y - q.y) ? s : e
    }
    return { p: best, d: Math.hypot(best.x - q.x, best.y - q.y) }
  }
  let best = { p: q, d: Infinity }
  for (const s of segs(p)) {
    const dx = s.b.x - s.a.x, dy = s.b.y - s.a.y
    const l2 = dx * dx + dy * dy
    const t = l2 ? Math.max(0, Math.min(1, ((q.x - s.a.x) * dx + (q.y - s.a.y) * dy) / l2)) : 0
    const c = { x: s.a.x + t * dx, y: s.a.y + t * dy }
    const d = Math.hypot(c.x - q.x, c.y - q.y)
    if (d < best.d) best = { p: c, d }
  }
  return best
}
