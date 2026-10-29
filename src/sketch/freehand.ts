import { bounds, extremePoints } from './geometry'
import { idMaker } from './ids'
import { newSketch, type Pt, type Sketch, type SketchEntity, type SketchPoint } from './types'

export const SIMPLIFY = 1 / 16
export const FIT = 1 / 32
export const CLOSE = 1 / 4

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y)

function segDist(p: Pt, a: Pt, b: Pt): number {
  const l2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2
  if (l2 === 0) return dist(p, a)
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2))
  return dist(p, { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) })
}

/** Ramer–Douglas–Peucker: the indices of the points that keep the stroke within `tol`. */
export function simplify(pts: Pt[], tol = SIMPLIFY): number[] {
  if (pts.length <= 2) return pts.map((_, i) => i)
  const keep = new Set([0, pts.length - 1])
  const stack: [number, number][] = [[0, pts.length - 1]]
  while (stack.length) {
    const [i, j] = stack.pop()!
    let worst = -1, at = -1
    for (let k = i + 1; k < j; k++) {
      const d = segDist(pts[k], pts[i], pts[j])
      if (d > worst) { worst = d; at = k }
    }
    if (worst > tol) { keep.add(at); stack.push([i, at], [at, j]) }
  }
  return [...keep].sort((a, b) => a - b)
}

/** Least-squares circle through the points (Kåsa). */
export function fitCircle(pts: Pt[]): { c: Pt; r: number } | null {
  const n = pts.length
  if (n < 3) return null
  const mx = pts.reduce((s, p) => s + p.x, 0) / n, my = pts.reduce((s, p) => s + p.y, 0) / n
  let suu = 0, svv = 0, suv = 0, suuu = 0, svvv = 0, suvv = 0, svuu = 0
  for (const p of pts) {
    const u = p.x - mx, v = p.y - my
    suu += u * u; svv += v * v; suv += u * v
    suuu += u * u * u; svvv += v * v * v; suvv += u * v * v; svuu += v * u * u
  }
  const det = suu * svv - suv * suv
  if (Math.abs(det) < 1e-12) return null
  const b1 = (suuu + suvv) / 2, b2 = (svvv + svuu) / 2
  const uc = (b1 * svv - b2 * suv) / det, vc = (suu * b2 - suv * b1) / det
  const c = { x: uc + mx, y: vc + my }
  const r = Math.sqrt(uc * uc + vc * vc + (suu + svv) / n)
  return Number.isFinite(r) ? { c, r } : null
}

const fitsLine = (raw: Pt[], a: Pt, b: Pt) => raw.every(p => segDist(p, a, b) <= FIT)

/** Total turning of the path around c (positive = counter-clockwise). */
function turning(raw: Pt[], c: Pt): number {
  let total = 0
  for (let i = 1; i < raw.length; i++) {
    let d = Math.atan2(raw[i].y - c.y, raw[i].x - c.x) - Math.atan2(raw[i - 1].y - c.y, raw[i - 1].x - c.x)
    while (d > Math.PI) d -= 2 * Math.PI
    while (d < -Math.PI) d += 2 * Math.PI
    total += d
  }
  return total
}

function fitsArc(raw: Pt[]): { c: Pt; r: number; sweep: number } | null {
  const f = fitCircle(raw)
  if (!f || f.r > 500) return null
  if (!raw.every(p => Math.abs(dist(p, f.c) - f.r) <= FIT)) return null
  const sweep = turning(raw, f.c)
  if (Math.abs(sweep) < (15 * Math.PI) / 180 || Math.abs(sweep) >= 2 * Math.PI - 1e-6) return null
  return { ...f, sweep }
}

/** A finger or mouse stroke becomes straight lines, arcs and smooth curves, added to the drawing. */
export function smoothStroke(input: Pt[], into: Sketch): Sketch {
  const raw = input.filter((p, i) => i === 0 || dist(p, input[i - 1]) > 1e-9)
  if (raw.length < 2) return into
  const pid = idMaker(into, 'fp')
  const eid = idMaker(into, 'fe')
  const points: SketchPoint[] = []
  const entities: SketchEntity[] = []
  const addPoint = (p: Pt) => { const q = { id: pid(), x: p.x, y: p.y }; points.push(q); return q }
  let length = 0
  for (let i = 1; i < raw.length; i++) length += dist(raw[i], raw[i - 1])
  const closed = raw.length >= 4 && dist(raw[0], raw[raw.length - 1]) <= CLOSE && length > 4 * CLOSE

  if (closed) {
    const f = fitCircle(raw)
    if (f && raw.every(p => Math.abs(dist(p, f.c) - f.r) <= FIT) && Math.abs(turning(raw, f.c)) > 1.5 * Math.PI) {
      const c = addPoint(f.c)
      entities.push({ id: eid(), kind: 'circle', center: c.id, r: f.r })
      return { ...into, points: [...into.points, ...points], entities: [...into.entities, ...entities] }
    }
  }

  const keep = simplify(raw)
  const verts = keep.map(i => addPoint(raw[i]))
  if (closed) {
    // Close it exactly: the last vertex becomes the first.
    if (verts.length > 2) { points.pop(); verts[verts.length - 1] = verts[0] } else return into
  }
  const rawBetween = (i: number, j: number) => raw.slice(keep[i], keep[j] + 1)
  let loose: number[] = []
  const flush = () => {
    if (loose.length >= 2) {
      entities.push(loose.length === 2
        ? { id: eid(), kind: 'line', a: verts[loose[0]].id, b: verts[loose[1]].id }
        : { id: eid(), kind: 'spline', points: loose.map(k => verts[k].id) })
    }
    loose = []
  }
  let i = 0
  while (i < verts.length - 1) {
    let lineTo = i + 1
    while (lineTo + 1 < verts.length && fitsLine(rawBetween(i, lineTo + 1), raw[keep[i]], raw[keep[lineTo + 1]])) lineTo++
    const lineOk = fitsLine(rawBetween(i, lineTo), raw[keep[i]], raw[keep[lineTo]])
    let arcTo = -1
    let arc: ReturnType<typeof fitsArc> = null
    for (let j = i + 2; j < verts.length; j++) {
      const a = fitsArc(rawBetween(i, j))
      if (!a) break
      arcTo = j
      arc = a
    }
    if (arc && arcTo > lineTo && arcTo - i >= 2) {
      flush()
      const s = verts[i], e = verts[arcTo]
      // The ends sit on the fitted circle so the arc is exact.
      for (const p of [s, e]) {
        const a = Math.atan2(p.y - arc.c.y, p.x - arc.c.x)
        p.x = arc.c.x + arc.r * Math.cos(a)
        p.y = arc.c.y + arc.r * Math.sin(a)
      }
      const c = addPoint(arc.c)
      entities.push(arc.sweep > 0 ? { id: eid(), kind: 'arc', center: c.id, start: s.id, end: e.id } : { id: eid(), kind: 'arc', center: c.id, start: e.id, end: s.id })
      i = arcTo
    } else if (lineOk) {
      flush()
      entities.push({ id: eid(), kind: 'line', a: verts[i].id, b: verts[lineTo].id })
      i = lineTo
    } else {
      if (!loose.length) loose.push(i)
      loose.push(i + 1)
      i++
    }
  }
  flush()
  return { ...into, points: [...into.points, ...points], entities: [...into.entities, ...entities] }
}

/** The drawing's overall extent, text included (text is about 0.6 × its height per letter). */
export function sketchBounds(sk: Sketch) {
  const polys = sk.entities.filter(e => !('construction' in e && e.construction)).map(e => {
    if (e.kind !== 'text') return extremePoints(sk, e)
    const at = sk.points.find(p => p.id === e.at)!
    return [{ x: at.x, y: at.y }, { x: at.x + 0.6 * e.height * e.text.length, y: at.y + e.height }]
  })
  return bounds(polys)
}

export const roundEighth = (v: number) => Math.max(1 / 8, Math.round(v * 8) / 8)

/** Scales the drawing so it is `width` inches wide (rounded to 1/8"); its corner moves to 0,0. */
export function scaleSketchTo(sk: Sketch, width: number): Sketch {
  const b = sketchBounds(sk)
  const w = b.maxX - b.minX
  if (!(w > 0)) return sk
  const k = roundEighth(width) / w
  return {
    ...sk,
    points: sk.points.map(p => ({ ...p, x: (p.x - b.minX) * k, y: (p.y - b.minY) * k })),
    entities: sk.entities.map(e => (e.kind === 'circle' ? { ...e, r: e.r * k } : e.kind === 'text' ? { ...e, height: e.height * k } : e))
  }
}

export type PresetKind = 'circle' | 'heart' | 'star' | 'letters'

/** Ready-made shapes for the kids: a circle, a heart, a star, or letters. `size` is the width in inches. */
export function presetShape(kind: PresetKind, size: number, text = 'ABC', id = 'k_preset'): Sketch {
  const names = { circle: 'Circle', heart: 'Heart', star: 'Star', letters: text }
  const s = newSketch(id, names[kind], 'freehand')
  const P = (pid: string, x: number, y: number) => { s.points.push({ id: pid, x, y }); return pid }
  if (kind === 'circle') {
    s.entities.push({ id: 'e1', kind: 'circle', center: P('c', 0, 0), r: 1 })
  } else if (kind === 'heart') {
    // Two round lobes and two straight sides meeting at the point.
    const R = 1, tip = { x: 0, y: -2.6 }
    const tangent = (cx: number, side: 1 | -1) => {
      const D = Math.hypot(tip.x - cx, tip.y)
      const phi = Math.atan2(tip.y, tip.x - cx)
      const cands = [phi + Math.acos(R / D), phi - Math.acos(R / D)].map(a => ({ x: cx + R * Math.cos(a), y: R * Math.sin(a) }))
      return cands.sort((a, b) => side * (b.x - a.x))[0]
    }
    const tr = tangent(1, 1), tl = tangent(-1, -1)
    P('tip', tip.x, tip.y); P('top', 0, 0); P('tr', tr.x, tr.y); P('tl', tl.x, tl.y); P('cr', 1, 0); P('cl', -1, 0)
    s.entities.push(
      { id: 'e1', kind: 'line', a: 'tip', b: 'tr' },
      { id: 'e2', kind: 'arc', center: 'cr', start: 'tr', end: 'top' },
      { id: 'e3', kind: 'arc', center: 'cl', start: 'top', end: 'tl' },
      { id: 'e4', kind: 'line', a: 'tl', b: 'tip' }
    )
  } else if (kind === 'star') {
    const ids = Array.from({ length: 10 }, (_, k) => {
      const r = k % 2 === 0 ? 1 : 0.382
      const a = Math.PI / 2 + (k * Math.PI) / 5
      return P(`s${k}`, r * Math.cos(a), r * Math.sin(a))
    })
    ids.forEach((pid, k) => s.entities.push({ id: `e${k + 1}`, kind: 'line', a: pid, b: ids[(k + 1) % 10] }))
  } else {
    s.entities.push({ id: 'e1', kind: 'text', at: P('at', 0, 0), text, height: 1 })
  }
  return scaleSketchTo(s, size)
}
