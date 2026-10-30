// The drawing board's state: the drawing being edited, its undo history, the tool, the selection and the solver's verdict.
import { createStore, useStore } from 'zustand'
import { formatInches } from '../model/units'
import { smoothStroke } from './freehand'
import { arcAngles, pointOf } from './geometry'
import { idMaker } from './ids'
import { isModifyError, tidy, type ModifyResult } from './modify'
import { snapTo as snapIn, type Snap } from './snap'
import { solverReady, solveSketch } from './solver'
import type { ConstraintKind, Pt, Sketch, SketchConstraint, SketchEntity } from './types'

export type Tool =
  | 'select' | 'line' | 'rect' | 'arc3' | 'arcCenter' | 'circle' | 'spline' | 'text' | 'construction'
  | 'dimension' | 'trim' | 'extend' | 'offset' | 'mirror' | 'fillet' | 'chamfer' | 'freehand'

/** A place to draw at: a position, and the existing point it landed on (snapped), if any. */
export type At = Pt & { ref?: string }

export type SolveState = { status: 'ok' | 'conflict' | 'failed'; dof: number; conflicting: string[] }

export type DrawContext = { boardId: string | null; kids: boolean; isNew: boolean }

export type DrawState = {
  sketch: Sketch
  past: Sketch[]
  future: Sketch[]
  tool: Tool
  selection: string[]
  solve: SolveState
  message: string | null
  context: DrawContext
  /** Changed since it was opened. */
  dirty: boolean

  begin(sk: Sketch, context?: Partial<DrawContext>): void
  setTool(t: Tool): void
  select(ids: string[]): void
  setMessage(m: string | null): void
  rename(name: string): void
  addPoint(p: At): string
  addLine(a: At, b: At, construction?: boolean): string | null
  addRect(a: At, b: At): string[]
  addArc3(start: At, end: At, through: Pt): string | null
  addArcCenter(c: At, start: At, end: Pt): string | null
  addCircle(c: At, r: number): string | null
  addSpline(pts: At[]): string | null
  addText(at: At, text: string, height: number): string | null
  addStroke(pts: Pt[]): void
  addConstraint(kind: ConstraintKind, refs: string[], value?: number): string | null
  setDimension(id: string, value: number): boolean
  remove(ids: string[]): void
  modify(fn: (sk: Sketch) => ModifyResult): boolean
  replace(sk: Sketch): void
  dragPoint(id: string, to: Pt): void
  endDrag(): void
  undo(): void
  redo(): void
  snap(q: Pt, tol: number, opts?: { grid?: number; from?: Pt; ignore?: string[] }): Snap
  /** Points picked on the tracing picture to scale it (null when not picking). */
  refPick: Pt[] | null
  setRefPick(p: Pt[] | null): void
}

const MAX_HISTORY = 200
const snap64 = (v: number) => Math.round(v * 64) / 64

export const CONFLICT_MESSAGE = 'These disagree — remove one of these:'
export const FAILED_MESSAGE = "That change couldn't be solved — undo it or remove a dimension."

const NAMES: Record<ConstraintKind, string> = {
  horizontal: 'Level', vertical: 'Upright', perpendicular: 'Square', parallel: 'Parallel', equal: 'Equal',
  tangent: 'Tangent', concentric: 'Same centre', coincident: 'Touching', fixed: 'Fixed in place', symmetric: 'Symmetric',
  distance: 'Length', hdistance: 'Width', vdistance: 'Height', radius: 'Radius', diameter: 'Diameter', angle: 'Angle'
}

/** How a rule reads in a list: "Length 10"", "Square". */
export function describeConstraint(c: SketchConstraint): string {
  if (c.value === undefined) return NAMES[c.kind]
  return `${NAMES[c.kind]} ${c.kind === 'angle' ? `${Math.round(c.value * 100) / 100}°` : formatInches(c.value)}`
}

export const isDimension = (k: ConstraintKind) => ['distance', 'hdistance', 'vdistance', 'radius', 'diameter', 'angle'].includes(k)

/** What a dimension would measure right now (so a new one starts at the drawn size). */
export function currentValue(sk: Sketch, kind: ConstraintKind, refs: string[]): number | null {
  const ent = (id: string) => sk.entities.find(e => e.id === id)
  const isPt = (id: string) => sk.points.some(p => p.id === id)
  const two = (): [Pt, Pt] | null => {
    if (refs.length === 2 && refs.every(isPt)) return [pointOf(sk, refs[0]), pointOf(sk, refs[1])]
    const e = refs.length === 1 ? ent(refs[0]) : undefined
    if (e?.kind === 'line') return [pointOf(sk, e.a), pointOf(sk, e.b)]
    return null
  }
  try {
    if (kind === 'distance') {
      if (refs.length === 2 && isPt(refs[0]) && ent(refs[1])?.kind === 'line') {
        const l = ent(refs[1]) as Extract<SketchEntity, { kind: 'line' }>
        const p = pointOf(sk, refs[0]), a = pointOf(sk, l.a), b = pointOf(sk, l.b)
        return Math.abs((b.x - a.x) * (a.y - p.y) - (a.x - p.x) * (b.y - a.y)) / Math.hypot(b.x - a.x, b.y - a.y)
      }
      const t = two()
      return t ? Math.hypot(t[1].x - t[0].x, t[1].y - t[0].y) : null
    }
    if (kind === 'hdistance' || kind === 'vdistance') {
      const t = two()
      return t ? Math.abs(kind === 'hdistance' ? t[1].x - t[0].x : t[1].y - t[0].y) : null
    }
    if (kind === 'radius' || kind === 'diameter') {
      const e = ent(refs[0])
      const r = e?.kind === 'circle' ? e.r : e?.kind === 'arc' ? Math.hypot(pointOf(sk, e.start).x - pointOf(sk, e.center).x, pointOf(sk, e.start).y - pointOf(sk, e.center).y) : null
      return r === null ? null : kind === 'radius' ? r : 2 * r
    }
    if (kind === 'angle') {
      const [l1, l2] = refs.map(ent)
      if (l1?.kind !== 'line' || l2?.kind !== 'line') return null
      const d = (l: { a: string; b: string }) => { const a = pointOf(sk, l.a), b = pointOf(sk, l.b); return Math.atan2(b.y - a.y, b.x - a.x) }
      let a = ((d(l2) - d(l1)) * 180) / Math.PI
      while (a < 0) a += 360
      while (a >= 360) a -= 360
      return a > 180 ? 360 - a : a
    }
  } catch {
    return null
  }
  return null
}

/** The two lines of an angle, ordered so the counter-clockwise angle from the first to the second is the opening (≤ 180°). */
export function angleOrder(sk: Sketch, refs: string[]): string[] {
  const [l1, l2] = refs.map(id => sk.entities.find(e => e.id === id))
  if (l1?.kind !== 'line' || l2?.kind !== 'line') return refs
  const d = (l: { a: string; b: string }) => { const a = pointOf(sk, l.a), b = pointOf(sk, l.b); return Math.atan2(b.y - a.y, b.x - a.x) }
  let a = d(l2) - d(l1)
  while (a < 0) a += 2 * Math.PI
  while (a >= 2 * Math.PI) a -= 2 * Math.PI
  return a > Math.PI ? [refs[1], refs[0]] : refs
}

const EMPTY: Sketch = { id: 'k_empty', name: 'Drawing', mode: 'precise', points: [], entities: [], constraints: [] }

export function createDrawStore() {
  return createStore<DrawState>((set, get) => {
    /** Applies a change: solves it, keeps an undo step, and reports conflicts. Returns whether it was kept. */
    const commit = (next: Sketch, opts: { history?: boolean } = {}): boolean => {
      const prev = get().sketch
      let solved = next
      let solve: SolveState = { status: 'ok', dof: -1, conflicting: [] }
      let message: string | null = null
      if (next.constraints.length && solverReady()) {
        const r = solveSketch(next)
        solve = { status: r.status, dof: r.dof, conflicting: r.conflicting }
        if (r.status === 'failed') {
          set({ message: FAILED_MESSAGE })
          return false
        }
        if (r.status === 'conflict') {
          const names = r.conflicting.map(id => next.constraints.find(c => c.id === id)).filter(Boolean).map(c => describeConstraint(c!))
          message = `${CONFLICT_MESSAGE} ${names.join(', ')}`
        }
        solved = r.sketch
      } else if (solverReady()) {
        solve = { status: 'ok', dof: solveSketch(next).dof, conflicting: [] }
      }
      const past = opts.history === false ? get().past : [...get().past, prev].slice(-MAX_HISTORY)
      set({ sketch: solved, past, future: opts.history === false ? get().future : [], solve, message, dirty: true })
      return true
    }

    const ids = () => ({ p: idMaker(get().sketch, 'p'), e: idMaker(get().sketch, 'e'), c: idMaker(get().sketch, 'c') })
    /** Use the point it snapped to, or make a new one (stored on the 1/64" grid). */
    const pointFor = (sk: Sketch, at: At, make: () => string): { sk: Sketch; id: string } => {
      if (at.ref && sk.points.some(p => p.id === at.ref)) return { sk, id: at.ref }
      const id = make()
      return { sk: { ...sk, points: [...sk.points, { id, x: snap64(at.x), y: snap64(at.y) }] }, id }
    }
    let dragStart: Sketch | null = null

    return {
      sketch: EMPTY,
      past: [],
      future: [],
      tool: 'select',
      selection: [],
      solve: { status: 'ok', dof: -1, conflicting: [] },
      message: null,
      context: { boardId: null, kids: false, isNew: true },
      dirty: false,

      begin: (sk, context = {}) => {
        set({
          sketch: sk, past: [], future: [], selection: [], message: null, dirty: false, refPick: null,
          tool: sk.mode === 'freehand' ? 'freehand' : 'select',
          context: { boardId: null, kids: false, isNew: false, ...context },
          solve: { status: 'ok', dof: -1, conflicting: [] }
        })
        if (sk.constraints.length && solverReady()) {
          const r = solveSketch(sk)
          set({ solve: { status: r.status, dof: r.dof, conflicting: r.conflicting } })
        }
      },
      setTool: tool => set({ tool, message: null }),
      select: selection => set({ selection }),
      setMessage: message => set({ message }),
      rename: name => commit({ ...get().sketch, name }),

      addPoint: at => {
        const i = ids()
        const r = pointFor(get().sketch, at, i.p)
        if (r.sk !== get().sketch) commit(r.sk)
        return r.id
      },
      addLine: (a, b, construction) => {
        const i = ids()
        let { sk, id: pa } = pointFor(get().sketch, a, i.p)
        const r = pointFor(sk, b, i.p)
        sk = r.sk
        if (pa === r.id || Math.hypot(pointOf(sk, pa).x - pointOf(sk, r.id).x, pointOf(sk, pa).y - pointOf(sk, r.id).y) < 1e-9) return null
        const id = i.e()
        commit({ ...sk, entities: [...sk.entities, { id, kind: 'line', a: pa, b: r.id, ...(construction ? { construction: true } : {}) }] })
        return id
      },
      addRect: (a, b) => {
        if (Math.abs(a.x - b.x) < 1e-9 || Math.abs(a.y - b.y) < 1e-9) return []
        const i = ids()
        let sk = get().sketch
        const c1 = pointFor(sk, a, i.p); sk = c1.sk
        const c3 = pointFor(sk, b, i.p); sk = c3.sk
        const c2 = pointFor(sk, { x: b.x, y: a.y }, i.p); sk = c2.sk
        const c4 = pointFor(sk, { x: a.x, y: b.y }, i.p); sk = c4.sk
        const lines = [[c1.id, c2.id], [c2.id, c3.id], [c3.id, c4.id], [c4.id, c1.id]].map(([p, q]) => ({ id: i.e(), kind: 'line' as const, a: p, b: q }))
        const rules: SketchConstraint[] = [
          { id: i.c(), kind: 'horizontal', refs: [lines[0].id] }, { id: i.c(), kind: 'horizontal', refs: [lines[2].id] },
          { id: i.c(), kind: 'vertical', refs: [lines[1].id] }, { id: i.c(), kind: 'vertical', refs: [lines[3].id] }
        ]
        commit({ ...sk, entities: [...sk.entities, ...lines], constraints: [...sk.constraints, ...rules] })
        return lines.map(l => l.id)
      },
      addArc3: (start, end, through) => {
        const s = { x: start.x, y: start.y }, e = { x: end.x, y: end.y }, t = through
        const d = 2 * (s.x * (e.y - t.y) + e.x * (t.y - s.y) + t.x * (s.y - e.y))
        if (Math.abs(d) < 1e-9) return null
        const ss = s.x * s.x + s.y * s.y, ee = e.x * e.x + e.y * e.y, tt = t.x * t.x + t.y * t.y
        const c = { x: (ss * (e.y - t.y) + ee * (t.y - s.y) + tt * (s.y - e.y)) / d, y: (ss * (t.x - e.x) + ee * (s.x - t.x) + tt * (e.x - s.x)) / d }
        // Counter-clockwise from start to end passes through `through` only if it lies inside that sweep.
        const { a0, sweep } = arcAngles(c, s, e)
        let at = Math.atan2(t.y - c.y, t.x - c.x) - a0
        while (at < 0) at += 2 * Math.PI
        const ccw = at < sweep
        const i = ids()
        let sk = get().sketch
        const ps = pointFor(sk, start, i.p); sk = ps.sk
        const pe = pointFor(sk, end, i.p); sk = pe.sk
        const cid = i.p()
        sk = { ...sk, points: [...sk.points, { id: cid, x: c.x, y: c.y }] }
        const id = i.e()
        commit({ ...sk, entities: [...sk.entities, { id, kind: 'arc', center: cid, start: ccw ? ps.id : pe.id, end: ccw ? pe.id : ps.id }] })
        return id
      },
      addArcCenter: (center, start, end) => {
        const r = Math.hypot(start.x - center.x, start.y - center.y)
        if (r < 1e-9) return null
        const a = Math.atan2(end.y - center.y, end.x - center.x)
        const i = ids()
        let sk = get().sketch
        const pc = pointFor(sk, center, i.p); sk = pc.sk
        const ps = pointFor(sk, start, i.p); sk = ps.sk
        const c = pointOf(sk, pc.id)
        const pe = pointFor(sk, { x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) }, i.p); sk = pe.sk
        const id = i.e()
        commit({ ...sk, entities: [...sk.entities, { id, kind: 'arc', center: pc.id, start: ps.id, end: pe.id }] })
        return id
      },
      addCircle: (center, r) => {
        if (!(r > 0)) return null
        const i = ids()
        const { sk, id: c } = pointFor(get().sketch, center, i.p)
        const id = i.e()
        commit({ ...sk, entities: [...sk.entities, { id, kind: 'circle', center: c, r: snap64(r) || r }] })
        return id
      },
      addSpline: pts => {
        if (pts.length < 2) return null
        const i = ids()
        let sk = get().sketch
        const pids: string[] = []
        for (const p of pts) { const r = pointFor(sk, p, i.p); sk = r.sk; pids.push(r.id) }
        const id = i.e()
        commit({ ...sk, entities: [...sk.entities, pids.length === 2 ? { id, kind: 'line', a: pids[0], b: pids[1] } : { id, kind: 'spline', points: pids }] })
        return id
      },
      addText: (at, text, height) => {
        if (!text.trim() || !(height > 0)) return null
        const i = ids()
        const { sk, id: p } = pointFor(get().sketch, at, i.p)
        const id = i.e()
        commit({ ...sk, entities: [...sk.entities, { id, kind: 'text', at: p, text: text.trim(), height }] })
        return id
      },
      addStroke: pts => {
        const next = smoothStroke(pts, get().sketch)
        if (next !== get().sketch) commit(next)
      },

      addConstraint: (kind, refs0, value) => {
        const id = ids().c()
        // An angle is measured counter-clockwise from the first line to the second: order them so it is the opening (≤ 180°).
        const refs = kind === 'angle' ? angleOrder(get().sketch, refs0) : refs0
        const v = value ?? (isDimension(kind) ? currentValue(get().sketch, kind, refs) ?? undefined : undefined)
        const c: SketchConstraint = v === undefined ? { id, kind, refs } : { id, kind, refs, value: v }
        const ok = commit({ ...get().sketch, constraints: [...get().sketch.constraints, c] })
        return ok ? id : null
      },
      setDimension: (id, value) => {
        const sk = get().sketch
        if (!sk.constraints.some(c => c.id === id) || !(value > 0)) return false
        const before = get().solve.status
        const next = { ...sk, constraints: sk.constraints.map(c => (c.id === id ? { ...c, value } : c)) }
        const ok = commit(next)
        // A typed size that can't be met leaves the drawing as it was.
        if (ok && get().solve.status === 'conflict' && before !== 'conflict') {
          const msg = get().message
          get().undo()
          set({ message: msg, future: [] })
          return false
        }
        return ok
      },
      remove: idsToGo => {
        const sk = get().sketch
        const go = new Set(idsToGo)
        // Removing a point removes the shapes built on it.
        const entities = sk.entities.filter(e => !go.has(e.id) && !(
          (e.kind === 'line' && (go.has(e.a) || go.has(e.b))) ||
          (e.kind === 'arc' && (go.has(e.center) || go.has(e.start) || go.has(e.end))) ||
          (e.kind === 'circle' && go.has(e.center)) ||
          (e.kind === 'spline' && e.points.some(p => go.has(p))) ||
          (e.kind === 'text' && go.has(e.at))))
        const gone = sk.entities.filter(e => !entities.includes(e))
        const candidates = gone.flatMap(e => (e.kind === 'line' ? [e.a, e.b] : e.kind === 'arc' ? [e.center, e.start, e.end] : e.kind === 'circle' ? [e.center] : e.kind === 'spline' ? e.points : [e.at]))
        const next = tidy({
          ...sk,
          points: sk.points.filter(p => !go.has(p.id)),
          entities,
          constraints: sk.constraints.filter(c => !go.has(c.id))
        }, candidates)
        set({ selection: [] })
        commit(next)
      },
      modify: fn => {
        const r = fn(get().sketch)
        if (isModifyError(r)) {
          set({ message: r.error })
          return false
        }
        return commit(r)
      },
      replace: sk => { commit(sk) },
      refPick: null,
      // Picking scale points uses plain clicks, so no drawing tool may take them.
      setRefPick: refPick => set(refPick ? { refPick, tool: 'select' } : { refPick }),
      dragPoint: (id, to) => {
        dragStart ??= get().sketch
        const base = get().sketch
        const moved = { ...base, points: base.points.map(p => (p.id === id ? { ...p, x: to.x, y: to.y } : p)) }
        if (!base.constraints.length || !solverReady()) {
          set({ sketch: moved })
          return
        }
        // Hold the dragged point where the pointer is and let everything else follow its rules.
        const hold: SketchConstraint = { id: '__drag', kind: 'fixed', refs: [id] }
        const r = solveSketch({ ...moved, constraints: [...moved.constraints, hold] })
        // Only the moved geometry comes back: the hold is not a rule of the drawing.
        if (r.status === 'ok') set({ sketch: { ...r.sketch, constraints: base.constraints } })
        else {
          // It can't go there (it is held by its rules): try once more without holding it, so it settles back.
          const free = solveSketch(moved)
          if (free.status === 'ok') set({ sketch: free.sketch })
        }
      },
      endDrag: () => {
        if (!dragStart) return
        const start = dragStart
        dragStart = null
        const now = get().sketch
        set({ sketch: start })
        commit(now)
      },
      undo: () => {
        const { past, sketch, future } = get()
        if (!past.length) return
        const prev = past[past.length - 1]
        set({ sketch: prev, past: past.slice(0, -1), future: [sketch, ...future], message: null, selection: [] })
        refreshSolve()
      },
      redo: () => {
        const { past, sketch, future } = get()
        if (!future.length) return
        set({ sketch: future[0], past: [...past, sketch], future: future.slice(1), message: null, selection: [] })
        refreshSolve()
      },
      snap: (q, tol, opts = {}) => snapIn(get().sketch, q, { tol, ...opts })
    }

    function refreshSolve() {
      const sk = get().sketch
      if (!solverReady()) return
      const r = solveSketch(sk)
      set({ solve: { status: r.status, dof: r.dof, conflicting: r.conflicting }, dirty: true })
    }
  })
}

export type DrawStore = ReturnType<typeof createDrawStore>
export const draw = createDrawStore()
export function useDraw<T>(selector: (s: DrawState) => T): T {
  return useStore(draw, selector)
}
