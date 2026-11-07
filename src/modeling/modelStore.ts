// The Custom modeling tools' state: which tool, which plane, the clicks and typed sizes so far, and the pull step.
// The 3D view feeds it pointer positions on the plane; the bar feeds it typed sizes. It changes the design through
// the studio store, so every finished step can be undone.
import { createStore, useStore } from 'zustand'
import { isAxisAligned, localAxes, type Axis } from '../model/geometry'
import type { Project } from '../model/types'
import { parseInches, snap64 } from '../model/units'
import type { Pt } from '../sketch/types'
import { studio } from '../ui/store'
import { cutThrough, facePlane, FLOOR, FRONT, isBlock, offsetPlane, profileProblem, pullProfile, pushPullFace, SIDE, type Profile, type WorkPlane } from './core'

export type ModelTool = 'rect' | 'circle' | 'outline' | 'pushpull' | 'face'
export type PlaneKind = 'floor' | 'front' | 'side' | 'face'

export type ModelState = {
  active: boolean
  tool: ModelTool | null
  planeKind: PlaneKind
  plane: WorkPlane
  /** The part whose face the plane is on (sketching on a part). */
  planeBoardId: string | null
  /** Points clicked so far, on the plane. */
  pts: Pt[]
  hover: Pt | null
  /** A closed profile waiting to be pulled. */
  profile: Profile | null
  /** How far the pointer has pulled it (live preview). */
  pull: number | null
  /** The face picked for Push/Pull. */
  face: { boardId: string; axis: Axis; side: 'min' | 'max' } | null
  woodId: string
  /** Plain-language hint for the next step, or what went wrong. */
  message: string
  error: boolean
  /** Counts finished parts for names (Part 1, Part 2…). */
  made: number
  /** The block being split into panels (the case generator fills it). */
  splitId: string | null
}

const HINTS: Record<ModelTool, string> = {
  rect: 'Click one corner, then the opposite corner (or type a size like 24 x 12).',
  circle: 'Click the center, then a point on the edge (or type the radius).',
  outline: 'Click each corner; type 11-3/4@90 or 3,4 for exact sizes. Click the first corner (or press Close) to finish.',
  pushpull: 'Click a face of a part, then drag or type how far to move it (negative pushes in).',
  face: 'Click a face of a part to sketch on it.'
}

const planeFor = (k: Exclude<PlaneKind, 'face'>): WorkPlane => (k === 'floor' ? FLOOR : k === 'front' ? FRONT : SIDE)

function initial(): ModelState {
  return {
    active: false, tool: null, planeKind: 'floor', plane: FLOOR, planeBoardId: null, pts: [], hover: null, profile: null, pull: null,
    face: null, woodId: 'ply-3-4', message: '', error: false, made: 0, splitId: null
  }
}

/** A signed size: "-3/4", "12", "1-1/2". */
export function parseSigned(text: string): number | null {
  const t = text.trim()
  const neg = t.startsWith('-')
  const r = parseInches(neg ? t.slice(1) : t)
  return r.ok ? (neg ? -r.value : r.value) : null
}

export function createModelStore() {
  return createStore<ModelState & {
    start(): void
    stop(): void
    setTool(t: ModelTool | null): void
    setPlane(k: Exclude<PlaneKind, 'face'>, at?: number): void
    setWood(id: string): void
    hoverAt(q: Pt | null): void
    clickAt(q: Pt): void
    type(text: string): boolean
    closeOutline(): void
    setPull(d: number | null): void
    finishPull(d?: number): boolean
    pickFace(boardId: string, axis: Axis, side: 'min' | 'max'): void
    cancelStep(): void
    splitSelected(): boolean
  }>()((set, get) => {
    const say = (message: string, error = false) => set({ message, error })
    const resetStep = () => set({ pts: [], hover: null, profile: null, pull: null, face: null })
    const apply = (fn: (p: Project) => Project | { error: string }): boolean => {
      let failed: string | null = null
      studio.getState().apply(p => { const r = fn(p); if ('error' in r) { failed = r.error; return p } return r })
      if (failed) { say(failed, true); return false }
      return true
    }
    const ready = (profile: Profile) => {
      const problem = profileProblem(profile)
      if (problem) { say(problem, true); return }
      set({ profile, pts: [], hover: null })
      // Looking straight at the plane hides the pull; turn to the 3D view.
      if (studio.getState().view !== '3d') studio.getState().set({ view: '3d' })
      say('Drag to pull it into a solid, or type how far (negative pulls the other way), then click or press Enter.')
    }
    /** A typed or dragged distance matched to the wood: within 1/16" of its real thickness becomes that thickness. */
    const toStock = (d: number) => {
      const w = studio.getState().project.woods.find(x => x.id === get().woodId)
      if (w && Math.abs(Math.abs(d) - w.thickness) <= 1 / 16 + 1e-9) return Math.sign(d) * w.thickness
      return snap64(d)
    }
    return {
      ...initial(),
      start() {
        const woods = studio.getState().project.woods
        const woodId = woods.some(w => w.id === get().woodId) ? get().woodId : woods[0]?.id ?? 'ply-3-4'
        set({ ...initial(), active: true, tool: 'rect', woodId, made: get().made })
        say(HINTS.rect)
      },
      stop() { set({ ...initial(), made: get().made }) },
      setTool(tool) {
        resetStep()
        set({ tool })
        say(tool ? HINTS[tool] : 'Choose a tool.')
      },
      setPlane(k, at = 0) {
        resetStep()
        set({ planeKind: k, plane: offsetPlane(planeFor(k), at), planeBoardId: null })
        if (get().tool === 'face' || get().tool === 'pushpull') set({ tool: 'rect' })
        say(`Sketching on the ${planeFor(k).label.toLowerCase()}${at ? ` ${at}" out` : ''}. ${HINTS[get().tool ?? 'rect']}`)
      },
      setWood(woodId) { set({ woodId }) },
      hoverAt(hover) { set({ hover }) },
      clickAt(q) {
        const s = get()
        if (s.profile) { s.finishPull(); return }
        if (s.tool === 'rect') {
          if (!s.pts.length) { set({ pts: [q] }); say('Now click the opposite corner, or type the size (like 24 x 12).'); return }
          ready({ kind: 'rect', a: s.pts[0], b: q })
        } else if (s.tool === 'circle') {
          if (!s.pts.length) { set({ pts: [q] }); say('Now click a point on the edge, or type the radius.'); return }
          ready({ kind: 'circle', c: s.pts[0], r: snap64(Math.hypot(q.x - s.pts[0].x, q.y - s.pts[0].y)) })
        } else if (s.tool === 'outline') {
          const first = s.pts[0]
          if (first && s.pts.length >= 3 && Math.hypot(q.x - first.x, q.y - first.y) < 0.2) { s.closeOutline(); return }
          set({ pts: [...s.pts, q] })
          say(s.pts.length ? 'Next corner (type 11-3/4@90 or 3,4), or click the first corner to close.' : 'Click the next corner, or type its distance (11-3/4@0) or offset (3,4).')
        }
      },
      type(text) {
        const s = get()
        const t = text.trim()
        if (!t) return false
        if (s.profile || s.face) {
          const d = parseSigned(t)
          if (d === null || d === 0) { say('Type a distance like 3/4, 12 or -1-1/2', true); return false }
          return s.finishPull(d)
        }
        if (s.tool === 'rect') {
          const m = /^\s*([^x×]+?)\s*[x×]\s*(.+?)\s*$/i.exec(t)
          const w = m ? parseSigned(m[1]) : null, h = m ? parseSigned(m[2]) : null
          if (w === null || h === null || !w || !h) { say('Type the size as width x height, like 24 x 12', true); return false }
          // From the first corner, toward the pointer (or up and right).
          const a = s.pts[0] ?? s.hover ?? { x: 0, y: 0 }
          const toward = s.hover && s.pts[0] ? s.hover : { x: a.x + 1, y: a.y + 1 }
          const sx = toward.x >= a.x ? 1 : -1, sy = toward.y >= a.y ? 1 : -1
          ready({ kind: 'rect', a, b: { x: a.x + sx * Math.abs(w), y: a.y + sy * Math.abs(h) } })
          return true
        }
        if (s.tool === 'circle') {
          const r = parseSigned(t)
          if (r === null || r <= 0) { say('Type the radius, like 6', true); return false }
          ready({ kind: 'circle', c: s.pts[0] ?? s.hover ?? { x: 0, y: 0 }, r })
          return true
        }
        if (s.tool === 'outline') {
          const last = s.pts.at(-1)
          if (!last) {
            // A first corner typed as x,y on the plane.
            const xy = /^\s*([^,]+?)\s*,\s*(.+?)\s*$/.exec(t)
            const x = xy ? parseSigned(xy[1]) ?? (xy[1].trim() === '0' ? 0 : null) : null, y = xy ? parseSigned(xy[2]) ?? (xy[2].trim() === '0' ? 0 : null) : null
            if (x === null || y === null) { say('Click the first corner, or type it as x,y', true); return false }
            set({ pts: [{ x, y }] })
            return true
          }
          const xy = /^\s*@?\s*([^,]+?)\s*,\s*(.+?)\s*$/.exec(t)
          let next: Pt | null = null
          const z = (v: string) => (/^\s*-?0\s*$/.test(v) ? 0 : parseSigned(v))
          if (xy) {
            const dx = z(xy[1]), dy = z(xy[2])
            if (dx !== null && dy !== null && (dx || dy)) next = { x: last.x + dx, y: last.y + dy }
          } else {
            const [lenText, angText] = t.split('@')
            const len = parseSigned(lenText)
            const ang = angText !== undefined ? Number(angText) : s.hover ? (Math.atan2(s.hover.y - last.y, s.hover.x - last.x) * 180) / Math.PI : 0
            if (len !== null && len > 0 && Number.isFinite(ang)) next = { x: snap64(last.x + len * Math.cos((ang * Math.PI) / 180)), y: snap64(last.y + len * Math.sin((ang * Math.PI) / 180)) }
          }
          if (!next) { say('Type a length@angle (11-3/4@90) or an offset (3,4)', true); return false }
          const first = s.pts[0]
          if (s.pts.length >= 3 && Math.hypot(next.x - first.x, next.y - first.y) < 1 / 64) { s.closeOutline(); return true }
          set({ pts: [...s.pts, next] })
          say('Next corner, or Close to finish.')
          return true
        }
        return false
      },
      closeOutline() {
        const s = get()
        if (s.tool !== 'outline' || s.pts.length < 3) { say('An outline needs at least three corners', true); return }
        ready({ kind: 'poly', pts: s.pts })
      },
      setPull(pull) { set({ pull }) },
      finishPull(d) {
        const s = get()
        const dist = d ?? s.pull
        if (s.face) {
          if (dist === null || dist === undefined || !snap64(dist)) { say('Drag the face or type how far to move it', true); return false }
          const f = s.face
          if (!apply(p => pushPullFace(p, f.boardId, f.axis, f.side, snap64(dist)))) return false
          set({ face: null, pull: null })
          say(`Moved the face ${snap64(dist)}". Click another face, or choose a tool.`)
          return true
        }
        if (!s.profile) return false
        const wood = studio.getState().project.woods.find(w => w.id === s.woodId)
        const raw = dist ?? wood?.thickness ?? 0.75
        const dd = toStock(raw)
        // Pulled into the part it was sketched on: a cut.
        if (s.planeBoardId && dd < 0) {
          const id = s.planeBoardId, pl = s.plane, prof = s.profile
          if (!apply(p => cutThrough(p, id, pl, prof, dd))) return false
          set({ profile: null, pull: null })
          say('Cut through. Sketch another shape, or choose a tool.')
          return true
        }
        const made = s.made + 1
        const name = `Part ${made}`
        let newId: string | null = null, note: string | undefined
        const ok = apply(p => {
          const r = pullProfile(p, s.plane, s.profile!, dd, s.woodId, name)
          if ('error' in r) return r
          newId = r.id
          note = r.note
          return r.project
        })
        if (!ok) return false
        set({ profile: null, pull: null, made })
        if (newId) studio.getState().select([newId])
        const made1 = studio.getState().project.boards.find(b => b.id === newId)
        const block = made1 && isBlock(made1)
        say(note ?? (block ? `${name} is a block. Press Split into panels to turn it into sides, top, bottom and shelves, or keep sketching.` : `${name} added. Sketch the next shape, or choose a tool.`))
        return true
      },
      pickFace(boardId, axis, side) {
        const s = get()
        const b = studio.getState().project.boards.find(x => x.id === boardId)
        if (!b) return
        if (!isAxisAligned(b)) { say('Pick a face of a square-set part', true); return }
        if (s.tool === 'pushpull') {
          set({ face: { boardId, axis, side }, pull: null })
          say(`${b.name}: drag or type how far to move that face (negative pushes in), then click or press Enter.`)
          return
        }
        if (s.tool === 'face' || s.tool === null) {
          resetStep()
          const thick = localAxes(b).thickness.axis === axis
          set({ planeKind: 'face', plane: facePlane(b, axis, side), planeBoardId: boardId, tool: 'rect' })
          say(`Sketching on ${b.name}'s ${thick ? 'face' : 'edge'}. Draw a shape; pull it out to add a part${thick ? ', or pull it into the part (negative) to cut through it' : ''}.`)
        }
      },
      cancelStep() {
        const s = get()
        if (s.pts.length || s.profile || s.face) { resetStep(); say(HINTS[s.tool ?? 'rect']) }
        else set({ tool: null, message: 'Choose a tool.' })
      },
      splitSelected() {
        const sel = studio.getState().selection
        const b = studio.getState().project.boards.find(x => x.id === sel[0])
        if (sel.length !== 1 || !b || !isBlock(b)) { say('Select one block (a solid at least 4" on every side) to split into panels', true); return false }
        set({ splitId: b.id })
        studio.getState().setView({ cabinet: 'case' })
        return true
      }
    }
  })
}

export const modeling = createModelStore()
export function useModeling<T>(sel: (s: ReturnType<typeof modeling.getState>) => T): T {
  return useStore(modeling, sel)
}
