// Changing what's drawn: fillet and chamfer corners, trim, extend, offset and mirror.
import { arcAngles, pointOf, signedArea, tessellateEntity } from './geometry'
import { idMaker } from './ids'
import { angleFrom, circleCircle, intersectPrims, lineCircle, lineLine, primOf } from './intersect'
import type { Pt, Sketch, SketchConstraint, SketchEntity, SketchPoint } from './types'

export type ModifyResult = Sketch | { error: string }
export const isModifyError = (r: ModifyResult): r is { error: string } => 'error' in r

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y)
const unit = (a: Pt, b: Pt): Pt => { const d = dist(a, b) || 1; return { x: (b.x - a.x) / d, y: (b.y - a.y) / d } }
const DIMENSIONS = new Set(['distance', 'hdistance', 'vdistance'])

const live = (e: SketchEntity) => e.kind !== 'text'
const pointIdsOf = (e: SketchEntity): string[] =>
  e.kind === 'line' ? [e.a, e.b] : e.kind === 'arc' ? [e.center, e.start, e.end] : e.kind === 'circle' ? [e.center] : e.kind === 'spline' ? [...e.points] : [e.at]

/** Removes the given points if no shape uses them any more, and any rules that point at something gone. */
export function tidy(sk: Sketch, candidates: string[] = []): Sketch {
  const used = new Set(sk.entities.flatMap(pointIdsOf))
  const drop = new Set(candidates.filter(id => !used.has(id)))
  const points = sk.points.filter(p => !drop.has(p.id))
  const ids = new Set([...points.map(p => p.id), ...sk.entities.map(e => e.id)])
  return { ...sk, points, constraints: sk.constraints.filter(c => c.refs.every(r => ids.has(r))) }
}

/** The two straight lines meeting at a corner point. */
function corner(sk: Sketch, pid: string): { l1: Extract<SketchEntity, { kind: 'line' }>; l2: Extract<SketchEntity, { kind: 'line' }> } | null {
  const lines = sk.entities.filter((e): e is Extract<SketchEntity, { kind: 'line' }> => e.kind === 'line' && !e.construction && (e.a === pid || e.b === pid))
  const others = sk.entities.filter(e => e.kind !== 'line' && pointIdsOf(e).includes(pid))
  return lines.length === 2 && others.length === 0 ? { l1: lines[0], l2: lines[1] } : null
}

function cornerCut(sk: Sketch, pid: string, size: number, kind: 'fillet' | 'chamfer'): ModifyResult {
  const c = corner(sk, pid)
  if (!c) return { error: 'Pick a corner where two straight lines meet' }
  if (!(size > 0)) return { error: 'Enter a size more than 0' }
  const P = pointOf(sk, pid)
  const far = (l: { a: string; b: string }) => pointOf(sk, l.a === pid ? l.b : l.a)
  const O1 = far(c.l1), O2 = far(c.l2)
  const u1 = unit(P, O1), u2 = unit(P, O2)
  const phi = Math.acos(Math.max(-1, Math.min(1, u1.x * u2.x + u1.y * u2.y)))
  if (phi < 1e-6 || Math.PI - phi < 1e-6) return { error: "These lines don't make a corner" }
  const t = kind === 'fillet' ? size / Math.tan(phi / 2) : size
  if (t >= dist(P, O1) - 1e-9 || t >= dist(P, O2) - 1e-9) return { error: kind === 'fillet' ? 'That radius is too big for these lines' : 'That chamfer is too big for these lines' }
  const pid_ = idMaker(sk, 'p'), eid = idMaker(sk, 'e'), cid = idMaker(sk, 'c')
  const T1: SketchPoint = { id: pid_(), x: P.x + u1.x * t, y: P.y + u1.y * t }
  const T2: SketchPoint = { id: pid_(), x: P.x + u2.x * t, y: P.y + u2.y * t }
  const points = [...sk.points, T1, T2]
  const swap = (l: Extract<SketchEntity, { kind: 'line' }>, to: string) => (l.a === pid ? { ...l, a: to } : { ...l, b: to })
  let entities = sk.entities.map(e => (e.id === c.l1.id ? swap(c.l1, T1.id) : e.id === c.l2.id ? swap(c.l2, T2.id) : e))
  // Length dimensions on the two lines no longer measure what they did.
  let constraints = sk.constraints.filter(k => !(DIMENSIONS.has(k.kind) && k.refs.length === 1 && (k.refs[0] === c.l1.id || k.refs[0] === c.l2.id)))
  if (kind === 'fillet') {
    const bis = unit({ x: 0, y: 0 }, { x: u1.x + u2.x, y: u1.y + u2.y })
    const C: SketchPoint = { id: pid_(), x: P.x + bis.x * (size / Math.sin(phi / 2)), y: P.y + bis.y * (size / Math.sin(phi / 2)) }
    points.push(C)
    const ccw = (T1.x - C.x) * (T2.y - C.y) - (T1.y - C.y) * (T2.x - C.x) > 0
    const arcId = eid()
    entities = [...entities, { id: arcId, kind: 'arc', center: C.id, start: ccw ? T1.id : T2.id, end: ccw ? T2.id : T1.id }]
    constraints = [...constraints,
      { id: cid(), kind: 'tangent', refs: [c.l1.id, arcId] }, { id: cid(), kind: 'tangent', refs: [c.l2.id, arcId] },
      { id: cid(), kind: 'radius', refs: [arcId], value: size }]
  } else {
    entities = [...entities, { id: eid(), kind: 'line', a: T1.id, b: T2.id }]
  }
  return tidy({ ...sk, points, entities, constraints }, [pid])
}

/** Rounds a corner between two lines with an arc of radius r, tangent to both. */
export const fillet = (sk: Sketch, cornerPointId: string, r: number) => cornerCut(sk, cornerPointId, r, 'fillet')
/** Cuts a corner off straight, d back along each line. */
export const chamfer = (sk: Sketch, cornerPointId: string, d: number) => cornerCut(sk, cornerPointId, d, 'chamfer')

/** Removes the piece of a shape between the nearest crossings either side of where it was clicked. */
export function trim(sk: Sketch, entityId: string, at: Pt): ModifyResult {
  const e = sk.entities.find(x => x.id === entityId)
  if (!e || !live(e)) return { error: 'Pick a line, arc or circle to trim' }
  const pe = primOf(sk, e)!
  const hits: Pt[] = []
  for (const o of sk.entities) {
    if (o.id === e.id || !live(o)) continue
    const po = primOf(sk, o)
    if (po) hits.push(...intersectPrims(pe, po))
  }
  const pid = idMaker(sk, 'p'), eid = idMaker(sk, 'e'), cid = idMaker(sk, 'c')
  const remove = (): Sketch => tidy({ ...sk, entities: sk.entities.filter(x => x.id !== e.id) }, pointIdsOf(e))
  const newPoint = (p: Pt): SketchPoint => ({ id: pid(), x: p.x, y: p.y })
  const noDims = (cs: SketchConstraint[]) => cs.filter(k => !(DIMENSIONS.has(k.kind) && k.refs.includes(e.id)))

  if (e.kind === 'line') {
    const a = pointOf(sk, e.a), b = pointOf(sk, e.b)
    const L2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2
    const param = (p: Pt) => ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / L2
    const ts = [...new Set(hits.map(param).filter(t => t > 1e-6 && t < 1 - 1e-6).map(t => Math.round(t * 1e9) / 1e9))].sort((x, y) => x - y)
    const tc = param(at)
    const lo = Math.max(0, ...ts.filter(t => t < tc)), hi = Math.min(1, ...ts.filter(t => t > tc))
    if (lo === 0 && hi === 1) return remove()
    const P = (t: number) => ({ x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) })
    if (lo === 0) {
      const n = newPoint(P(hi))
      return tidy({ ...sk, points: [...sk.points, n], entities: sk.entities.map(x => (x.id === e.id ? { ...e, a: n.id } : x)), constraints: noDims(sk.constraints) }, [e.a])
    }
    if (hi === 1) {
      const n = newPoint(P(lo))
      return tidy({ ...sk, points: [...sk.points, n], entities: sk.entities.map(x => (x.id === e.id ? { ...e, b: n.id } : x)), constraints: noDims(sk.constraints) }, [e.b])
    }
    const n1 = newPoint(P(lo)), n2 = newPoint(P(hi))
    const second = { id: eid(), kind: 'line' as const, a: n2.id, b: e.b, construction: e.construction }
    const copies = sk.constraints.filter(k => (k.kind === 'horizontal' || k.kind === 'vertical') && k.refs.length === 1 && k.refs[0] === e.id).map(k => ({ ...k, id: cid(), refs: [second.id] }))
    return tidy({
      ...sk,
      points: [...sk.points, n1, n2],
      entities: [...sk.entities.map(x => (x.id === e.id ? { ...e, b: n1.id } : x)), second],
      constraints: [...noDims(sk.constraints), ...copies]
    })
  }
  if (e.kind === 'arc' || e.kind === 'circle') {
    const c = pointOf(sk, e.center)
    const a0 = e.kind === 'arc' ? arcAngles(c, pointOf(sk, e.start), pointOf(sk, e.end)).a0 : 0
    const sweep = e.kind === 'arc' ? arcAngles(c, pointOf(sk, e.start), pointOf(sk, e.end)).sweep : 2 * Math.PI
    const r = e.kind === 'arc' ? dist(c, pointOf(sk, e.start)) : e.r
    const P = (ang: number) => ({ x: c.x + r * Math.cos(a0 + ang), y: c.y + r * Math.sin(a0 + ang) })
    const angs = [...new Set(hits.map(h => angleFrom(c, h, a0)).filter(t => t > 1e-6 && t < sweep - 1e-6).map(t => Math.round(t * 1e9) / 1e9))].sort((x, y) => x - y)
    const tc = angleFrom(c, at, a0)
    if (e.kind === 'circle') {
      if (angs.length < 2) return remove()
      const below = angs.filter(t => t < tc), above = angs.filter(t => t > tc)
      const lo = below.length ? below[below.length - 1] : angs[angs.length - 1]
      const hi = above.length ? above[0] : angs[0]
      const s = newPoint(P(hi)), en = newPoint(P(lo))
      const arc: SketchEntity = { id: e.id, kind: 'arc', center: e.center, start: s.id, end: en.id, construction: e.construction }
      return tidy({ ...sk, points: [...sk.points, s, en], entities: sk.entities.map(x => (x.id === e.id ? arc : x)) })
    }
    const lo = Math.max(0, ...angs.filter(t => t < tc)), hi = Math.min(sweep, ...angs.filter(t => t > tc))
    if (lo === 0 && hi === sweep) return remove()
    if (lo === 0) {
      const n = newPoint(P(hi))
      return tidy({ ...sk, points: [...sk.points, n], entities: sk.entities.map(x => (x.id === e.id ? { ...e, start: n.id } : x)), constraints: noDims(sk.constraints) }, [e.start])
    }
    if (hi === sweep) {
      const n = newPoint(P(lo))
      return tidy({ ...sk, points: [...sk.points, n], entities: sk.entities.map(x => (x.id === e.id ? { ...e, end: n.id } : x)), constraints: noDims(sk.constraints) }, [e.end])
    }
    const n1 = newPoint(P(lo)), n2 = newPoint(P(hi))
    return tidy({
      ...sk,
      points: [...sk.points, n1, n2],
      entities: [...sk.entities.map(x => (x.id === e.id ? { ...e, end: n1.id } : x)), { id: eid(), kind: 'arc', center: e.center, start: n2.id, end: e.end, construction: e.construction }],
      constraints: noDims(sk.constraints)
    })
  }
  return remove()
}

/** Lengthens a line from its nearer end until it meets another shape. */
export function extend(sk: Sketch, lineId: string, toEntityId: string): ModifyResult {
  const e = sk.entities.find(x => x.id === lineId)
  const t = sk.entities.find(x => x.id === toEntityId)
  if (!e || e.kind !== 'line') return { error: 'Pick a straight line to extend' }
  if (!t || !live(t) || t.id === e.id) return { error: 'Pick what to extend it to' }
  const a = pointOf(sk, e.a), b = pointOf(sk, e.b)
  const pt = primOf(sk, t)!
  const cands: number[] = []
  if (pt.type === 'seg') {
    const x = lineLine(a, b, pt.a, pt.b)
    if (x && x.u >= -1e-9 && x.u <= 1 + 1e-9) cands.push(x.t)
  } else if (pt.type === 'arc' || pt.type === 'circle') {
    const r = pt.type === 'arc' ? pt : { ...pt, a0: 0, sweep: 2 * Math.PI }
    for (const x of lineCircle(a, b, r.c, r.r)) {
      const d = angleFrom(r.c, x.p, r.a0)
      if (d <= r.sweep + 1e-7) cands.push(x.t)
    }
  } else {
    for (let i = 1; i < pt.pts.length; i++) {
      const x = lineLine(a, b, pt.pts[i - 1], pt.pts[i])
      if (x && x.u >= -1e-9 && x.u <= 1 + 1e-9) cands.push(x.t)
    }
  }
  const ext = cands.filter(v => v > 1 + 1e-9 || v < -1e-9).map(v => ({ v, gain: v > 1 ? v - 1 : -v })).sort((x, y) => x.gain - y.gain)[0]
  if (!ext) return { error: "That line can't reach it" }
  const end = ext.v > 1 ? 'b' : 'a'
  const p = { x: a.x + ext.v * (b.x - a.x), y: a.y + ext.v * (b.y - a.y) }
  const moving = e[end]
  const shared = sk.entities.some(x => x.id !== e.id && pointIdsOf(x).includes(moving))
  const constraints = sk.constraints.filter(k => !(DIMENSIONS.has(k.kind) && k.refs.length === 1 && k.refs[0] === e.id))
  if (shared) {
    const n = { id: idMaker(sk, 'p')(), ...p }
    return tidy({ ...sk, points: [...sk.points, n], entities: sk.entities.map(x => (x.id === e.id ? { ...e, [end]: n.id } : x)), constraints })
  }
  return { ...sk, points: sk.points.map(q => (q.id === moving ? { ...q, ...p } : q)), constraints }
}

// ---- offset ----

type Step = { e: SketchEntity; from: string; to: string }

/** Orders the chosen shapes into chains that run end to end. */
function chains(sk: Sketch, ids: string[]): { steps: Step[]; closed: boolean }[] {
  const ents = sk.entities.filter(e => ids.includes(e.id) && (e.kind === 'line' || e.kind === 'arc' || e.kind === 'spline'))
  const ends = (e: SketchEntity): [string, string] => (e.kind === 'line' ? [e.a, e.b] : e.kind === 'arc' ? [e.start, e.end] : [(e as { points: string[] }).points[0], (e as { points: string[] }).points.at(-1)!])
  const used = new Set<string>()
  const out: { steps: Step[]; closed: boolean }[] = []
  const deg = (pid: string) => ents.filter(e => ends(e).includes(pid)).length
  const walk = (start: SketchEntity, from: string) => {
    const steps: Step[] = []
    let e: SketchEntity | undefined = start, at = from
    while (e && !used.has(e.id)) {
      used.add(e.id)
      const [x, y] = ends(e)
      const to = x === at ? y : x
      steps.push({ e, from: at, to })
      at = to
      e = ents.find(f => !used.has(f.id) && ends(f).includes(at))
    }
    return steps
  }
  // Open chains start at a loose end; what's left are closed loops.
  for (const e of ents) {
    if (used.has(e.id)) continue
    const [x, y] = ends(e)
    if (deg(x) === 1) out.push({ steps: walk(e, x), closed: false })
    else if (deg(y) === 1) out.push({ steps: walk(e, y), closed: false })
  }
  for (const e of ents) {
    if (used.has(e.id)) continue
    const steps = walk(e, ends(e)[0])
    out.push({ steps, closed: steps.length > 0 && steps[steps.length - 1].to === steps[0].from })
  }
  return out
}

type Off = { kind: 'line'; a: Pt; b: Pt } | { kind: 'round'; c: Pt; r: number; ccw: boolean; s: Pt; e: Pt; centerId: string } | { kind: 'spline'; pts: Pt[] }

function offsetStep(sk: Sketch, st: Step, d: number): Off | { error: string } {
  const P = (id: string) => pointOf(sk, id)
  const s = P(st.from), t = P(st.to)
  if (st.e.kind === 'line') {
    const u = unit(s, t)
    const n = { x: u.y, y: -u.x } // right of travel
    return { kind: 'line', a: { x: s.x + n.x * d, y: s.y + n.y * d }, b: { x: t.x + n.x * d, y: t.y + n.y * d } }
  }
  if (st.e.kind === 'arc') {
    const c = P(st.e.center)
    const ccw = st.from === st.e.start
    // Travelling counter-clockwise, the right-hand side is away from the centre.
    const r = dist(c, P(st.e.start)) + (ccw ? d : -d)
    if (r <= 1e-6) return { error: 'That offset is bigger than one of the curves' }
    const on = (q: Pt) => { const u = unit(c, q); return { x: c.x + u.x * r, y: c.y + u.y * r } }
    return { kind: 'round', c, r, ccw, s: on(s), e: on(t), centerId: st.e.center }
  }
  const pts = (st.e as { points: string[] }).points.map(P)
  const fwd = st.from === (st.e as { points: string[] }).points[0] ? pts : [...pts].reverse()
  return {
    kind: 'spline',
    pts: fwd.map((q, i) => {
      const u = unit(fwd[Math.max(0, i - 1)], fwd[Math.min(fwd.length - 1, i + 1)])
      return { x: q.x + u.y * d, y: q.y - u.x * d }
    })
  }
}

const startOf = (o: Off): Pt => (o.kind === 'line' ? o.a : o.kind === 'round' ? o.s : o.pts[0])
const endOf = (o: Off): Pt => (o.kind === 'line' ? o.b : o.kind === 'round' ? o.e : o.pts[o.pts.length - 1])

/** Where two offset pieces should meet: their crossing nearest to the simple offset point. */
function join(p: Off, q: Off): Pt {
  const naive = endOf(p)
  const near = (cands: Pt[]) => (cands.length ? cands.reduce((best, c) => (dist(c, naive) < dist(best, naive) ? c : best)) : naive)
  if (p.kind === 'line' && q.kind === 'line') return lineLine(p.a, p.b, q.a, q.b)?.p ?? naive
  if (p.kind === 'line' && q.kind === 'round') return near(lineCircle(p.a, p.b, q.c, q.r).map(x => x.p))
  if (p.kind === 'round' && q.kind === 'line') return near(lineCircle(q.a, q.b, p.c, p.r).map(x => x.p))
  if (p.kind === 'round' && q.kind === 'round') return near(circleCircle(p.c, p.r, q.c, q.r))
  return naive
}

/**
 * Draws a copy of the chosen shapes `d` inches away. A closed outline grows outward for a positive distance
 * (shrinks for a negative one); an open chain moves to the right of the way it was drawn; circles grow.
 */
export function offset(sk: Sketch, entityIds: string[], d: number): ModifyResult {
  if (!d) return { error: 'Enter a distance' }
  const pid = idMaker(sk, 'p'), eid = idMaker(sk, 'e')
  const points: SketchPoint[] = [...sk.points]
  const entities: SketchEntity[] = [...sk.entities]
  const add = (p: Pt) => { const q = { id: pid(), x: p.x, y: p.y }; points.push(q); return q.id }
  let any = false
  for (const e of sk.entities) {
    if (!entityIds.includes(e.id) || e.kind !== 'circle') continue
    if (e.r + d <= 1e-6) return { error: 'That offset is bigger than one of the circles' }
    entities.push({ id: eid(), kind: 'circle', center: e.center, r: e.r + d })
    any = true
  }
  for (const ch of chains(sk, entityIds)) {
    if (!ch.steps.length) continue
    let side = d
    if (ch.closed) {
      // Make "outward" mean outward whichever way round the loop was drawn.
      const poly = ch.steps.flatMap(st => {
        const pts = tessellateEntity(sk, st.e)
        const from = pointOf(sk, st.from)
        return (dist(pts[0], from) <= dist(pts[pts.length - 1], from) ? pts : [...pts].reverse()).slice(0, -1)
      })
      const area = signedArea(poly)
      side = area > 0 ? d : -d // counter-clockwise: right of travel is outward
    }
    const offs: Off[] = []
    for (const st of ch.steps) {
      const o = offsetStep(sk, st, side)
      if ('error' in o) return o
      offs.push(o)
    }
    const n = offs.length
    const joints: string[] = []
    for (let i = 0; i < n; i++) {
      if (i === n - 1 && !ch.closed) break
      joints.push(add(join(offs[i], offs[(i + 1) % n])))
    }
    const startId = ch.closed ? joints[n - 1] : add(startOf(offs[0]))
    const endId = (i: number) => (i < joints.length ? joints[i] : add(endOf(offs[n - 1])))
    let prev = startId
    for (let i = 0; i < n; i++) {
      const o = offs[i]
      const to = ch.closed ? joints[i] : endId(i)
      if (o.kind === 'line') entities.push({ id: eid(), kind: 'line', a: prev, b: to })
      else if (o.kind === 'round') entities.push(o.ccw ? { id: eid(), kind: 'arc', center: o.centerId, start: prev, end: to } : { id: eid(), kind: 'arc', center: o.centerId, start: to, end: prev })
      else entities.push({ id: eid(), kind: 'spline', points: [prev, ...o.pts.slice(1, -1).map(add), to] })
      prev = to
    }
    any = true
  }
  if (!any) return { error: 'Pick lines, arcs or circles to offset' }
  return { ...sk, points, entities }
}

/** A mirror image of the chosen shapes across a line, kept symmetric by rules. */
export function mirror(sk: Sketch, entityIds: string[], axisLineId: string): ModifyResult {
  const ax = sk.entities.find(e => e.id === axisLineId)
  if (!ax || ax.kind !== 'line') return { error: 'Pick a straight line to mirror across' }
  const A = pointOf(sk, ax.a), B = pointOf(sk, ax.b)
  const u = unit(A, B)
  const reflect = (p: Pt): Pt => {
    const t = (p.x - A.x) * u.x + (p.y - A.y) * u.y
    const f = { x: A.x + t * u.x, y: A.y + t * u.y }
    return { x: 2 * f.x - p.x, y: 2 * f.y - p.y }
  }
  const pid = idMaker(sk, 'p'), eid = idMaker(sk, 'e'), cid = idMaker(sk, 'c')
  const points = [...sk.points]
  const constraints = [...sk.constraints]
  const map = new Map<string, string>()
  const m = (id: string) => {
    const hit = map.get(id)
    if (hit) return hit
    const p = pointOf(sk, id)
    const q = reflect(p)
    if (dist(p, q) < 1e-9) { map.set(id, id); return id }
    const n = { id: pid(), ...q }
    points.push(n)
    map.set(id, n.id)
    constraints.push({ id: cid(), kind: 'symmetric', refs: [id, n.id, axisLineId] })
    return n.id
  }
  const added: SketchEntity[] = []
  for (const e of sk.entities) {
    if (!entityIds.includes(e.id) || e.id === axisLineId) continue
    if (e.kind === 'line') added.push({ id: eid(), kind: 'line', a: m(e.a), b: m(e.b), construction: e.construction })
    else if (e.kind === 'arc') added.push({ id: eid(), kind: 'arc', center: m(e.center), start: m(e.end), end: m(e.start), construction: e.construction })
    else if (e.kind === 'circle') added.push({ id: eid(), kind: 'circle', center: m(e.center), r: e.r, construction: e.construction })
    else if (e.kind === 'spline') added.push({ id: eid(), kind: 'spline', points: e.points.map(m), construction: e.construction })
    else added.push({ ...e, id: eid(), at: m(e.at) })
  }
  if (!added.length) return { error: 'Pick shapes to mirror' }
  return { ...sk, points, entities: [...sk.entities, ...added], constraints }
}
