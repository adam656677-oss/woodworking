import type { Outline, Pt, Sketch, SketchEntity } from './types'

/** Ends closer than this (inches) count as joined. */
export const JOIN = 1 / 64

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y)

export function pointOf(sk: Sketch, id: string): Pt {
  const p = sk.points.find(q => q.id === id)
  if (!p) throw new Error(`Missing point ${id}`)
  return { x: p.x, y: p.y }
}

/** Catmull–Rom curve through the points (the curve passes through every point). */
function catmullRom(pts: Pt[], step: number): Pt[] {
  if (pts.length < 3) return pts.map(p => ({ ...p }))
  const out: Pt[] = [{ ...pts[0] }]
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)]
    const n = Math.max(2, Math.ceil(dist(p1, p2) / step))
    for (let k = 1; k <= n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t
      if (k === n) { out.push({ ...p2 }); continue }
      out.push({
        x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3)
      })
    }
  }
  return out
}

/** Arc angles: start angle and counter-clockwise sweep (0 < sweep ≤ 2π). */
export function arcAngles(c: Pt, s: Pt, e: Pt): { a0: number; sweep: number; r: number } {
  const a0 = Math.atan2(s.y - c.y, s.x - c.x)
  let sweep = Math.atan2(e.y - c.y, e.x - c.x) - a0
  while (sweep <= 1e-12) sweep += 2 * Math.PI
  return { a0, sweep, r: dist(c, s) }
}

/** Points along one shape, every `step` inches or closer. Text has no outline. */
export function tessellate(sk: Sketch, entityId: string, step = 1 / 32): Pt[] {
  const e = sk.entities.find(x => x.id === entityId)
  if (!e) return []
  return tessellateEntity(sk, e, step)
}

export function tessellateEntity(sk: Sketch, e: SketchEntity, step = 1 / 32): Pt[] {
  const P = (id: string) => pointOf(sk, id)
  switch (e.kind) {
    case 'line': return [P(e.a), P(e.b)]
    case 'arc': {
      const c = P(e.center), s = P(e.start), end = P(e.end)
      const { a0, sweep, r } = arcAngles(c, s, end)
      const n = Math.max(4, Math.ceil((r * sweep) / step))
      const out: Pt[] = [s]
      for (let k = 1; k < n; k++) {
        const a = a0 + (sweep * k) / n
        out.push({ x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) })
      }
      out.push(end)
      return out
    }
    case 'circle': {
      const c = P(e.center)
      const n = Math.max(48, Math.ceil((2 * Math.PI * e.r) / step))
      return Array.from({ length: n }, (_, k) => ({ x: c.x + e.r * Math.cos((2 * Math.PI * k) / n), y: c.y + e.r * Math.sin((2 * Math.PI * k) / n) }))
    }
    case 'spline': return catmullRom(e.points.map(P), step)
    case 'text': return []
  }
}

/** Points that bound a shape exactly: arcs and circles use their true extremes, not the drawn polygon. */
export function extremePoints(sk: Sketch, e: SketchEntity): Pt[] {
  const P = (id: string) => pointOf(sk, id)
  if (e.kind === 'circle') {
    const c = P(e.center)
    return [{ x: c.x - e.r, y: c.y - e.r }, { x: c.x + e.r, y: c.y + e.r }]
  }
  if (e.kind === 'arc') {
    const c = P(e.center), s = P(e.start), end = P(e.end)
    const { a0, sweep, r } = arcAngles(c, s, end)
    const out = [s, end]
    for (let k = -4; k <= 8; k++) {
      const a = (k * Math.PI) / 2
      let d = a - a0
      while (d < 0) d += 2 * Math.PI
      while (d >= 2 * Math.PI) d -= 2 * Math.PI
      if (d <= sweep) out.push({ x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) })
    }
    return out
  }
  return tessellateEntity(sk, e)
}

/** The two ends of a shape that can be part of an outline (lines, arcs, curves). */
export function endsOf(sk: Sketch, e: SketchEntity): [Pt, Pt] | null {
  const P = (id: string) => pointOf(sk, id)
  if (e.kind === 'line') return [P(e.a), P(e.b)]
  if (e.kind === 'arc') return [P(e.start), P(e.end)]
  if (e.kind === 'spline') return [P(e.points[0]), P(e.points[e.points.length - 1])]
  return null
}

const usable = (e: SketchEntity) => !('construction' in e && e.construction)

/** Chains shapes end-to-end. Closed chains are loops (entity ids in order); loose ends are gaps. */
export function findLoops(sk: Sketch): { closed: string[][]; gaps: Pt[]; junctions: Pt[] } {
  const edges = sk.entities.filter(usable).flatMap(e => {
    const ends = endsOf(sk, e)
    return ends ? [{ id: e.id, ends }] : []
  })
  // Cluster the ends that touch.
  const nodes: Pt[] = []
  const nodeOf = (p: Pt) => {
    const i = nodes.findIndex(n => dist(n, p) <= JOIN)
    if (i >= 0) return i
    nodes.push(p)
    return nodes.length - 1
  }
  const ed = edges.map(e => ({ id: e.id, n: [nodeOf(e.ends[0]), nodeOf(e.ends[1])] as [number, number] }))
  const degree = nodes.map(() => 0)
  for (const e of ed) { degree[e.n[0]]++; degree[e.n[1]]++ }
  const gaps: Pt[] = []
  const junctions: Pt[] = []
  const closed: string[][] = []
  const seen = new Set<string>()
  // Components.
  for (const start of ed) {
    if (seen.has(start.id)) continue
    const comp: typeof ed = []
    const stack = [start]
    seen.add(start.id)
    while (stack.length) {
      const e = stack.pop()!
      comp.push(e)
      for (const f of ed) if (!seen.has(f.id) && (f.n.includes(e.n[0]) || f.n.includes(e.n[1]))) { seen.add(f.id); stack.push(f) }
    }
    const compNodes = [...new Set(comp.flatMap(e => e.n))]
    const loose = compNodes.filter(n => degree[n] !== 2)
    if (loose.length) {
      for (const n of loose) (degree[n] === 1 ? gaps : junctions).push({ ...nodes[n] })
      continue
    }
    // Walk the ring.
    const order: string[] = [comp[0].id]
    const used = new Set(order)
    let at = comp[0].n[1]
    while (order.length < comp.length) {
      const next = comp.find(e => !used.has(e.id) && e.n.includes(at))
      if (!next) break
      order.push(next.id)
      used.add(next.id)
      at = next.n[0] === at ? next.n[1] : next.n[0]
    }
    closed.push(order)
  }
  return { closed, gaps, junctions }
}

/** A closed loop as one polygon (the last point is not repeated). */
export function loopPolygon(sk: Sketch, loop: string[], step = 1 / 32): Pt[] {
  const parts = loop.map(id => tessellate(sk, id, step))
  if (parts.length === 1) {
    const p = parts[0]
    return p.length > 1 && dist(p[0], p[p.length - 1]) <= JOIN ? p.slice(0, -1) : p
  }
  const first = parts[0]
  const nxt = parts[1]
  const lastFirst = first[first.length - 1]
  const touches = (q: Pt) => dist(q, nxt[0]) <= JOIN || dist(q, nxt[nxt.length - 1]) <= JOIN
  const out: Pt[] = touches(lastFirst) ? [...first] : [...first].reverse()
  for (const part of parts.slice(1)) {
    const end = out[out.length - 1]
    const seg = dist(part[0], end) <= dist(part[part.length - 1], end) ? part : [...part].reverse()
    out.push(...seg.slice(1))
  }
  if (out.length > 1 && dist(out[0], out[out.length - 1]) <= JOIN) out.pop()
  return out
}

function segHit(a: Pt, b: Pt, c: Pt, d: Pt): Pt | null {
  const r = { x: b.x - a.x, y: b.y - a.y }, s = { x: d.x - c.x, y: d.y - c.y }
  const den = r.x * s.y - r.y * s.x
  if (Math.abs(den) < 1e-15) return null
  const t = ((c.x - a.x) * s.y - (c.y - a.y) * s.x) / den
  const u = ((c.x - a.x) * r.y - (c.y - a.y) * r.x) / den
  const eps = 1e-9
  if (t <= eps || t >= 1 - eps || u <= eps || u >= 1 - eps) return null
  return { x: a.x + t * r.x, y: a.y + t * r.y }
}

/** Where a closed polygon crosses itself, or null. */
export function selfCrossing(poly: Pt[]): Pt | null {
  const n = poly.length
  if (n < 4) return null
  const bb = poly.map((p, i) => {
    const q = poly[(i + 1) % n]
    return [Math.min(p.x, q.x), Math.max(p.x, q.x), Math.min(p.y, q.y), Math.max(p.y, q.y)]
  })
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue
      const A = bb[i], B = bb[j]
      if (A[1] < B[0] || B[1] < A[0] || A[3] < B[2] || B[3] < A[2]) continue
      const hit = segHit(poly[i], poly[(i + 1) % n], poly[j], poly[(j + 1) % n])
      if (hit) return hit
    }
  }
  return null
}

/** Signed area: positive when the points run counter-clockwise. */
export function signedArea(poly: Pt[]): number {
  let a = 0
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length]
    a += p.x * q.y - q.x * p.y
  }
  return a / 2
}
export const polygonArea = (poly: Pt[]) => Math.abs(signedArea(poly))

export function bounds(polys: Pt[][]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const poly of polys) for (const p of poly) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  return { minX, minY, maxX, maxY }
}

export function pointInPolygon(p: Pt, poly: Pt[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j]
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}

export const MSG_GAP = 'This outline has a gap — close it to make a part'
export const MSG_JUNCTION = 'Three or more lines meet here — an outline must be one closed path.'
export const MSG_CROSS = 'The outline crosses itself here.'
export const MSG_EMPTY = 'Draw a closed shape first.'
export const MSG_OUTSIDE = 'Part of the drawing is outside the outline — move it inside or delete it.'

export type OutlineResult = { outline: Outline; outer: Pt[]; holes: Pt[][] } | { error: string; at?: Pt }

/** The part a drawing makes: the biggest closed shape is the outline; closed shapes inside it are cutouts, circles holes. */
export function outlineFromSketch(sk: Sketch): OutlineResult {
  const { closed, gaps, junctions } = findLoops(sk)
  if (junctions.length) return { error: MSG_JUNCTION, at: junctions[0] }
  if (gaps.length) return { error: MSG_GAP, at: gaps[0] }
  type Cand = { ids: string[]; circle: boolean; poly: Pt[]; area: number }
  const cands: Cand[] = []
  for (const loop of closed) {
    const poly = loopPolygon(sk, loop)
    const x = selfCrossing(poly)
    if (x) return { error: MSG_CROSS, at: x }
    cands.push({ ids: loop, circle: false, poly, area: polygonArea(poly) })
  }
  for (const e of sk.entities) {
    if (e.kind === 'circle' && usable(e)) {
      const poly = tessellateEntity(sk, e)
      cands.push({ ids: [e.id], circle: true, poly, area: polygonArea(poly) })
    }
  }
  if (!cands.length) return { error: MSG_EMPTY }
  cands.sort((a, b) => b.area - a.area)
  const [outer, ...rest] = cands
  const holes: Pt[][] = []
  const outline: Outline = { sketchId: sk.id, outer: outer.ids, holes: [], circles: [] }
  for (const c of rest) {
    if (!c.poly.every(p => pointInPolygon(p, outer.poly))) return { error: MSG_OUTSIDE, at: c.poly[0] }
    holes.push(c.poly)
    if (c.circle) outline.circles.push(c.ids[0])
    else outline.holes.push(c.ids)
  }
  return { outline, outer: outer.poly, holes }
}
