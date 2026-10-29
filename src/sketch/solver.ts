import { GcsWrapper, init_planegcs_module, type ModuleStatic, type SketchPrimitive } from '@salusoft89/planegcs'
import { arcAngles } from './geometry'
import type { Sketch, SketchConstraint, SketchEntity } from './types'

export type SolveResult = { sketch: Sketch; status: 'ok' | 'conflict' | 'failed'; dof: number; conflicting: string[] }

/** Each solve is held to well under the 250 ms limit by capping the solver's iterations. */
export const MAX_ITERATIONS = 400

let mod: ModuleStatic | null = null
let loading: Promise<void> | null = null

/** Loads FreeCAD's solver (planegcs, WebAssembly). `locate` gives the .wasm address in the app. */
export function initSolver(locate?: () => string): Promise<void> {
  if (mod) return Promise.resolve()
  loading ??= init_planegcs_module(locate ? { locateFile: locate } : undefined).then((m: unknown) => { mod = m as ModuleStatic })
  return loading as Promise<void>
}
export const solverReady = () => mod !== null

const deg = (d: number) => (d * Math.PI) / 180

/** Turns one of our rules into the solver's. Several solver rules may share one of ours (`id#n`). */
function toGcs(c: SketchConstraint, sk: Sketch): SketchPrimitive[] {
  const ent = (id: string) => sk.entities.find(e => e.id === id)
  const isPoint = (id: string) => sk.points.some(p => p.id === id)
  const kind = (id: string) => (isPoint(id) ? 'point' : ent(id)?.kind)
  const ends = (id: string): [string, string] | null => {
    const e = ent(id)
    if (e?.kind === 'line') return [e.a, e.b]
    if (e?.kind === 'arc') return [e.start, e.end]
    return null
  }
  /** Two points from either [p1, p2] or [line]. */
  const pair = (): [string, string] | null => (c.refs.length === 2 && c.refs.every(isPoint) ? [c.refs[0], c.refs[1]] : c.refs.length === 1 ? ends(c.refs[0]) : null)
  const centerOf = (id: string) => { const e = ent(id); return e && (e.kind === 'arc' || e.kind === 'circle') ? e.center : null }
  const [r0, r1, r2] = c.refs
  const id = c.id
  const v = c.value ?? 0
  switch (c.kind) {
    case 'horizontal':
    case 'vertical': {
      const t = c.kind === 'horizontal' ? 'horizontal' : 'vertical'
      if (kind(r0) === 'line') return [{ id, type: `${t}_l`, l_id: r0 } as SketchPrimitive]
      if (isPoint(r0) && isPoint(r1)) return [{ id, type: `${t}_pp`, p1_id: r0, p2_id: r1 } as SketchPrimitive]
      return []
    }
    case 'perpendicular': return [{ id, type: 'perpendicular_ll', l1_id: r0, l2_id: r1 }]
    case 'parallel': return [{ id, type: 'parallel', l1_id: r0, l2_id: r1 }]
    case 'equal': {
      const k0 = kind(r0), k1 = kind(r1)
      if (k0 === 'line' && k1 === 'line') return [{ id, type: 'equal_length', l1_id: r0, l2_id: r1 }]
      if (k0 === 'circle' && k1 === 'circle') return [{ id, type: 'equal_radius_cc', c1_id: r0, c2_id: r1 }]
      if (k0 === 'arc' && k1 === 'arc') return [{ id, type: 'equal_radius_aa', a1_id: r0, a2_id: r1 }]
      if (k0 === 'circle' && k1 === 'arc') return [{ id, type: 'equal_radius_ca', c1_id: r0, a2_id: r1 }]
      if (k0 === 'arc' && k1 === 'circle') return [{ id, type: 'equal_radius_ca', c1_id: r1, a2_id: r0 }]
      return []
    }
    case 'tangent': {
      const k0 = kind(r0), k1 = kind(r1)
      const [l, o] = k0 === 'line' ? [r0, r1] : [r1, r0]
      const ko = kind(o)
      if (kind(l) === 'line' && ko === 'arc') return [{ id, type: 'tangent_la', l_id: l, a_id: o }]
      if (kind(l) === 'line' && ko === 'circle') return [{ id, type: 'tangent_lc', l_id: l, c_id: o }]
      if (k0 === 'arc' && k1 === 'arc') return [{ id, type: 'tangent_aa', a1_id: r0, a2_id: r1 }]
      if (k0 === 'circle' && k1 === 'circle') return [{ id, type: 'tangent_cc', c1_id: r0, c2_id: r1 }]
      if (k0 === 'circle' && k1 === 'arc') return [{ id, type: 'tangent_ca', c_id: r0, a_id: r1 }]
      if (k0 === 'arc' && k1 === 'circle') return [{ id, type: 'tangent_ca', c_id: r1, a_id: r0 }]
      return []
    }
    case 'concentric': {
      const a = centerOf(r0), b = centerOf(r1)
      return a && b ? [{ id, type: 'p2p_coincident', p1_id: a, p2_id: b }] : []
    }
    case 'coincident': {
      const k1 = kind(r1)
      if (isPoint(r0) && k1 === 'point') return [{ id, type: 'p2p_coincident', p1_id: r0, p2_id: r1 }]
      if (isPoint(r0) && k1 === 'line') return [{ id, type: 'point_on_line_pl', p_id: r0, l_id: r1 }]
      if (isPoint(r0) && k1 === 'circle') return [{ id, type: 'point_on_circle', p_id: r0, c_id: r1 }]
      if (isPoint(r0) && k1 === 'arc') return [{ id, type: 'point_on_arc', p_id: r0, a_id: r1 }]
      return []
    }
    case 'fixed': {
      const p = sk.points.find(q => q.id === r0)
      if (!p) return []
      return [{ id: `${id}#x`, type: 'coordinate_x', p_id: r0, x: p.x }, { id: `${id}#y`, type: 'coordinate_y', p_id: r0, y: p.y }]
    }
    case 'symmetric':
      if (kind(r2) === 'line') return [{ id, type: 'p2p_symmetric_ppl', p1_id: r0, p2_id: r1, l_id: r2 }]
      if (isPoint(r2)) return [{ id, type: 'p2p_symmetric_ppp', p1_id: r0, p2_id: r1, p_id: r2 }]
      return []
    case 'distance': {
      if (isPoint(r0) && kind(r1) === 'line') return [{ id, type: 'p2l_distance', p_id: r0, l_id: r1, distance: v }]
      const pp = pair()
      return pp ? [{ id, type: 'p2p_distance', p1_id: pp[0], p2_id: pp[1], distance: v }] : []
    }
    case 'hdistance':
    case 'vdistance': {
      const pp = pair()
      if (!pp) return []
      const prop = c.kind === 'hdistance' ? 'x' : 'y'
      // Keep the points in the order they are drawn: the distance is measured from the first to the second.
      const p = (pid: string) => sk.points.find(q => q.id === pid)!
      const sign = p(pp[1])[prop] >= p(pp[0])[prop] ? 1 : -1
      return [{ id, type: 'difference', param1: { o_id: pp[0], prop }, param2: { o_id: pp[1], prop }, difference: sign * v }]
    }
    case 'radius':
      if (kind(r0) === 'circle') return [{ id, type: 'circle_radius', c_id: r0, radius: v }]
      if (kind(r0) === 'arc') return [{ id, type: 'arc_radius', a_id: r0, radius: v }]
      return []
    case 'diameter':
      if (kind(r0) === 'circle') return [{ id, type: 'circle_diameter', c_id: r0, diameter: v }]
      if (kind(r0) === 'arc') return [{ id, type: 'arc_diameter', a_id: r0, diameter: v }]
      return []
    case 'angle': return [{ id, type: 'l2l_angle_ll', l1_id: r0, l2_id: r1, angle: deg(v) }]
  }
}

function geometry(sk: Sketch): SketchPrimitive[] {
  const P = (pid: string) => sk.points.find(q => q.id === pid)!
  const out: SketchPrimitive[] = sk.points.map(p => ({ id: p.id, type: 'point', x: p.x, y: p.y, fixed: !!p.fixed }))
  for (const e of sk.entities) {
    if (e.kind === 'line') out.push({ id: e.id, type: 'line', p1_id: e.a, p2_id: e.b })
    else if (e.kind === 'circle') out.push({ id: e.id, type: 'circle', c_id: e.center, radius: e.r })
    else if (e.kind === 'arc') {
      const { a0, sweep, r } = arcAngles(P(e.center), P(e.start), P(e.end))
      out.push({ id: e.id, type: 'arc', c_id: e.center, start_id: e.start, end_id: e.end, start_angle: a0, end_angle: a0 + sweep, radius: r })
      out.push({ id: `${e.id}#rules`, type: 'arc_rules', a_id: e.id })
    }
  }
  return out
}

/** Our rule id for a solver rule id. */
const ownerOf = (gid: string) => gid.split('#')[0]

/** Solves the drawing's dimensions and rules. On a conflict or failure the drawing comes back unchanged. */
export function solveSketch(sk: Sketch): SolveResult {
  if (!mod) throw new Error('The shape solver is not loaded yet.')
  const g = new GcsWrapper(new mod.GcsSystem(), mod)
  try {
    const rules = sk.constraints.flatMap(c => toGcs(c, sk))
    g.push_primitives_and_params([...geometry(sk), ...rules])
    g.set_max_iterations(MAX_ITERATIONS)
    const code = g.solve()
    const dof = g.gcs.dof()
    const own = (ids: string[]) => [...new Set(ids.map(ownerOf))].filter(id => sk.constraints.some(c => c.id === id))
    if (g.has_gcs_conflicting_constraints()) {
      return { sketch: sk, status: 'conflict', dof, conflicting: own(g.get_gcs_conflicting_constraints()) }
    }
    if (code !== 0 && code !== 1) return { sketch: sk, status: 'failed', dof, conflicting: [] }
    g.apply_solution()
    const prims = g.sketch_index.get_primitives()
    const byId = new Map(prims.map(p => [p.id, p]))
    const points = sk.points.map(p => {
      const q = byId.get(p.id) as { x: number; y: number } | undefined
      return q ? { ...p, x: q.x, y: q.y } : p
    })
    const entities: SketchEntity[] = sk.entities.map(e => {
      if (e.kind !== 'circle') return e
      const q = byId.get(e.id) as { radius: number } | undefined
      return q ? { ...e, r: q.radius } : e
    })
    const bad = points.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y)) || entities.some(e => e.kind === 'circle' && !(e.r > 0))
    if (bad) return { sketch: sk, status: 'failed', dof, conflicting: [] }
    return { sketch: { ...sk, points, entities }, status: 'ok', dof, conflicting: [] }
  } catch {
    return { sketch: sk, status: 'failed', dof: 0, conflicting: [] }
  } finally {
    g.destroy_gcs_module()
  }
}
