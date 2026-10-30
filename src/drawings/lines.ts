// Vector line work for shop drawings: each part's edges seen from a view, split into visible and hidden pieces.
import * as THREE from 'three'
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from 'three-mesh-bvh'
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg'
import { boardMatrix, localSolids } from '../checks/solids'
import type { Project, Vec3 } from '../model/types'

;(THREE.BufferGeometry.prototype as any).computeBoundsTree = computeBoundsTree
;(THREE.BufferGeometry.prototype as any).disposeBoundsTree = disposeBoundsTree
;(THREE.Mesh.prototype as any).raycast = acceleratedRaycast

export type ViewName = 'front' | 'side' | 'top' | 'iso'
/** A view: the direction toward the viewer, and the screen's right and up directions (world). */
export type View = { toViewer: Vec3; right: Vec3; up: Vec3 }
export const VIEWS: Record<ViewName, View> = {
  front: { toViewer: { x: 0, y: -1, z: 0 }, right: { x: 1, y: 0, z: 0 }, up: { x: 0, y: 0, z: 1 } },
  side: { toViewer: { x: 1, y: 0, z: 0 }, right: { x: 0, y: 1, z: 0 }, up: { x: 0, y: 0, z: 1 } },
  top: { toViewer: { x: 0, y: 0, z: 1 }, right: { x: 1, y: 0, z: 0 }, up: { x: 0, y: 1, z: 0 } },
  // Isometric from the front-left, above.
  iso: (() => {
    const v = new THREE.Vector3(-1, -1, 1).normalize()
    const r = new THREE.Vector3(0, 0, 1).cross(v).normalize()
    const u = v.clone().cross(r).normalize()
    return { toViewer: { x: v.x, y: v.y, z: v.z }, right: { x: r.x, y: r.y, z: r.z }, up: { x: u.x, y: u.y, z: u.z } }
  })()
}

/** A section: everything on the far side of the plane through `at` along `axis` is cut away (`keep` says which side stays). */
export type Clip = { axis: 'x' | 'y' | 'z'; at: number; keep: 'low' | 'high' }
const evaluator = new Evaluator()
evaluator.attributes = ['position', 'normal', 'uv']
/** The part with the cut-away side removed (null when nothing of it is left). */
function clipped(world: THREE.BufferGeometry, c: Clip): THREE.BufferGeometry | null {
  world.computeBoundingBox()
  const bb = world.boundingBox!
  const lo = bb.min[c.axis], hi = bb.max[c.axis]
  if (c.keep === 'low' ? lo >= c.at : hi <= c.at) return null
  if (c.keep === 'low' ? hi <= c.at : lo >= c.at) return world.clone()
  const big = 1e4
  const box = new Brush(new THREE.BoxGeometry(big, big, big))
  const centre = { x: 0, y: 0, z: 0 }
  centre[c.axis] = c.keep === 'low' ? c.at + big / 2 : c.at - big / 2
  box.position.set(centre.x, centre.y, centre.z)
  box.updateMatrixWorld()
  const a = new Brush(world.clone())
  a.updateMatrixWorld()
  const r = evaluator.evaluate(a, box, SUBTRACTION) as Brush
  return r.geometry.getAttribute('position')?.count ? r.geometry : null
}

export type Seg = { a: [number, number]; b: [number, number]; hidden: boolean; boardId: string }
/** `cut` holds the triangles of the faces a section cuts through (to shade them). */
export type Lines = { segs: Seg[]; min: [number, number]; max: [number, number]; cut?: [number, number][][] }

const dot = (p: THREE.Vector3, d: Vec3) => p.x * d.x + p.y * d.y + p.z * d.z

/**
 * The edges of every part (or these) as seen from a view. An edge is hidden where something lies between it and
 * the viewer; edges are tested at small steps, so a partly hidden edge comes out as visible and hidden pieces.
 * `offsets` moves parts (the exploded view).
 */
export function viewLines(p: Project, view: View, opts: { ids?: string[]; offsets?: Map<string, Vec3>; hidden?: boolean; angle?: number; clip?: Clip; local?: boolean; solids?: Map<string, THREE.BufferGeometry> } = {}): Lines {
  const boards = opts.ids ? p.boards.filter(b => opts.ids!.includes(b.id)) : p.boards
  const solids = opts.solids ?? localSolids(p)
  const dir = new THREE.Vector3(view.toViewer.x, view.toViewer.y, view.toViewer.z).normalize()
  const worlds: THREE.BufferGeometry[] = []
  const edges: { id: string; pos: Float32Array }[] = []
  const cutTris: THREE.Vector3[][] = []
  for (const b of boards) {
    const g = solids.get(b.id)!
    // A part sheet draws the part in its own coordinates (x across, y along, z through).
    const m = opts.local ? new THREE.Matrix4() : boardMatrix(b)
    const off = opts.offsets?.get(b.id)
    if (off) m.premultiply(new THREE.Matrix4().makeTranslation(off.x, off.y, off.z))
    let world = g.clone().applyMatrix4(m)
    if (opts.clip) {
      const cut = clipped(world, opts.clip)
      world.dispose()
      if (!cut) continue
      world = cut
      // The cut faces: triangles lying on the section plane.
      const clip = opts.clip
      const pos = world.getAttribute('position'), idx = world.getIndex()
      const n = idx ? idx.count : pos.count
      const at = (i: number) => new THREE.Vector3().fromBufferAttribute(pos, idx ? idx.getX(i) : i)
      for (let i = 0; i + 2 < n; i += 3) {
        const tri = [at(i), at(i + 1), at(i + 2)]
        if (tri.every(q => Math.abs(q[clip.axis] - clip.at) < 1e-4)) cutTris.push(tri)
      }
    }
    if (opts.clip) {
      world.computeBoundsTree()
      edges.push({ id: b.id, pos: edgesFacing(edgeTable(world, opts.angle ?? 20), dir) })
      world.disposeBoundsTree()
    } else edges.push({ id: b.id, pos: edgesFacing(localTable(g, opts.angle ?? 20), dir, m) })
    worlds.push(world)
  }
  // Everything that can hide a line, in one searchable mesh.
  const all = new THREE.BufferGeometry()
  {
    let count = 0
    for (const w of worlds) count += w.getIndex() ? w.getIndex()!.count : w.getAttribute('position').count
    const arr = new Float32Array(count * 3)
    let k = 0
    for (const w of worlds) {
      const pos = w.getAttribute('position'), idx = w.getIndex()
      const n = idx ? idx.count : pos.count
      for (let i = 0; i < n; i++) { const j = idx ? idx.getX(i) : i; arr[k++] = pos.getX(j); arr[k++] = pos.getY(j); arr[k++] = pos.getZ(j) }
      w.dispose()
    }
    all.setAttribute('position', new THREE.BufferAttribute(arr, 3))
  }
  if (all.getAttribute('position').count) all.computeBoundsTree()
  const meshes = all.getAttribute('position').count ? [new THREE.Mesh(all, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }))] : []
  const ray = new THREE.Raycaster()
  ray.firstHitOnly = true
  const occluded = (q: THREE.Vector3) => {
    // From just in front of the point toward the viewer: anything hit is in the way.
    ray.set(q.clone().addScaledVector(dir, 2e-3), dir)
    ray.near = 0
    ray.far = 1e5
    return ray.intersectObjects(meshes, false).length > 0
  }
  const segs: Seg[] = []
  const P = (q: THREE.Vector3): [number, number] => [dot(q, view.right), dot(q, view.up)]
  for (const { id, pos } of edges) {
    for (let i = 0; i < pos.length; i += 6) {
      const a = new THREE.Vector3(pos[i], pos[i + 1], pos[i + 2]), b = new THREE.Vector3(pos[i + 3], pos[i + 4], pos[i + 5])
      // Edges seen end-on are points: skip them.
      const sa = P(a), sb = P(b)
      const len = Math.hypot(sb[0] - sa[0], sb[1] - sa[1])
      if (len < 1e-4) continue
      const n = Math.max(1, Math.min(40, Math.ceil(len / 0.25)))
      let runStart = 0
      let runHidden = occluded(a.clone().lerp(b, 0.5 / n))
      for (let k = 1; k <= n; k++) {
        const h = k < n ? occluded(a.clone().lerp(b, (k + 0.5) / n)) : !runHidden
        if (h !== runHidden || k === n) {
          const t0 = runStart / n, t1 = k / n
          segs.push({ a: P(a.clone().lerp(b, t0)), b: P(a.clone().lerp(b, t1)), hidden: runHidden, boardId: id })
          runStart = k
          runHidden = h
        }
      }
    }
  }
  if (meshes.length) all.disposeBoundsTree()
  all.dispose()
  const kept = opts.hidden === false ? segs.filter(s => !s.hidden) : segs
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const s of kept) for (const q of [s.a, s.b]) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]) }
  if (!kept.length) { x0 = y0 = x1 = y1 = 0 }
  return { segs: mergeSegs(kept), min: [x0, y0], max: [x1, y1], ...(opts.clip ? { cut: cutTris.map(t => t.map(P)) } : {}) }
}

/**
 * Joins pieces that lie on the same line into single runs (so dashes come out evenly), and drops hidden runs
 * wherever a visible line covers them.
 */
function mergeSegs(segs: Seg[]): Seg[] {
  type Run = { t0: number; t1: number; boardId: string }
  const lines = new Map<string, { o: [number, number]; d: [number, number]; vis: Run[]; hid: Run[] }>()
  for (const s of segs) {
    let dx = s.b[0] - s.a[0], dy = s.b[1] - s.a[1]
    const len = Math.hypot(dx, dy)
    if (len < 1e-6) continue
    dx /= len; dy /= len
    // One direction per line, then the line's distance from the origin.
    if (dx < -1e-9 || (Math.abs(dx) <= 1e-9 && dy < 0)) { dx = -dx; dy = -dy }
    const off = s.a[0] * -dy + s.a[1] * dx
    const k = `${Math.round(Math.atan2(dy, dx) * 2e3)}:${Math.round(off * 2e3)}`
    let L = lines.get(k)
    if (!L) lines.set(k, (L = { o: [-dy * off, dx * off], d: [dx, dy], vis: [], hid: [] }))
    const t = (q: [number, number]) => (q[0] - L!.o[0]) * L!.d[0] + (q[1] - L!.o[1]) * L!.d[1]
    const ta = t(s.a), tb = t(s.b)
    ;(s.hidden ? L.hid : L.vis).push({ t0: Math.min(ta, tb), t1: Math.max(ta, tb), boardId: s.boardId })
  }
  const union = (rs: Run[]): Run[] => {
    const out: Run[] = []
    for (const r of [...rs].sort((x, y) => x.t0 - y.t0)) {
      const last = out[out.length - 1]
      if (last && r.t0 <= last.t1 + 1e-4) last.t1 = Math.max(last.t1, r.t1)
      else out.push({ ...r })
    }
    return out
  }
  const out: Seg[] = []
  for (const L of lines.values()) {
    const P = (t: number): [number, number] => [L.o[0] + L.d[0] * t, L.o[1] + L.d[1] * t]
    const vis = union(L.vis)
    // Specks under 1/200" are noise from the cut-up meshes.
    for (const r of vis) if (r.t1 - r.t0 > 5e-3) out.push({ a: P(r.t0), b: P(r.t1), hidden: false, boardId: r.boardId })
    for (const h of union(L.hid)) {
      // Cut away the visible stretches.
      let pieces: Run[] = [h]
      for (const v of vis) pieces = pieces.flatMap(p => (v.t1 <= p.t0 || v.t0 >= p.t1 ? [p] : [
        ...(v.t0 > p.t0 + 1e-4 ? [{ ...p, t1: v.t0 }] : []), ...(v.t1 < p.t1 - 1e-4 ? [{ ...p, t0: v.t1 }] : [])]))
      for (const r of pieces) if (r.t1 - r.t0 > 5e-3) out.push({ a: P(r.t0), b: P(r.t1), hidden: true, boardId: r.boardId })
    }
  }
  return out
}

/** A part's edges with the normals of the faces on each side (one side for an open edge). */
type EdgeTable = { a: THREE.Vector3; b: THREE.Vector3; n1: THREE.Vector3; n2: THREE.Vector3 | null; crease: boolean }[]

/**
 * Every edge that could be drawn: creases (faces meeting at more than `angle` degrees), open edges, and smooth
 * edges (kept for silhouettes, which depend on the view). Seams inside a flat face are dropped: cut-up meshes have
 * T-junctions (one face's edge running along another's side) and thin sliver triangles whose own normals can't be
 * trusted, so a sliver takes the normal of the flat face it lies in. The geometry must have its bounds tree built.
 */
function edgeTable(g: THREE.BufferGeometry, angle: number): EdgeTable {
  const pos = g.getAttribute('position'), idx = g.getIndex()
  const n = idx ? idx.count : pos.count
  const P = (i: number) => new THREE.Vector3().fromBufferAttribute(pos, idx ? idx.getX(i) : i)
  const key = (v: THREE.Vector3) => `${Math.round(v.x * 1e4)},${Math.round(v.y * 1e4)},${Math.round(v.z * 1e4)}`
  const T = Math.floor(n / 3)
  const verts: THREE.Vector3[][] = []
  const normals: (THREE.Vector3 | null)[] = []
  const edges = new Map<string, { a: THREE.Vector3; b: THREE.Vector3; tris: number[]; third: THREE.Vector3 }>()
  const triEdges: string[][] = []
  for (let t = 0; t < T; t++) {
    const v = [P(t * 3), P(t * 3 + 1), P(t * 3 + 2)]
    verts.push(v)
    const cr = v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0]))
    const longest = Math.max(v[0].distanceTo(v[1]), v[1].distanceTo(v[2]), v[2].distanceTo(v[0]))
    // A sliver: its height over its longest side is under a thousandth of an inch.
    normals.push(longest > 0 && cr.length() / longest >= 1e-3 ? cr.normalize() : null)
    const mine: string[] = []
    for (let k = 0; k < 3; k++) {
      const a = v[k], b = v[(k + 1) % 3]
      const ka = key(a), kb = key(b)
      if (ka === kb) continue
      const kk = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`
      const e = edges.get(kk)
      if (e) e.tris.push(t)
      else edges.set(kk, { a, b, tris: [t], third: v[(k + 2) % 3] })
      mine.push(kk)
    }
    triEdges.push(mine)
  }
  // Slivers take the normal of a neighbouring face whose plane they lie in.
  for (let pass = 0; pass < 6; pass++) {
    let changed = false
    for (let t = 0; t < T; t++) {
      if (normals[t]) continue
      for (const kk of triEdges[t]) {
        for (const o of edges.get(kk)!.tris) {
          const no = normals[o]
          if (o === t || !no) continue
          const p0 = verts[o][0]
          if (verts[t].every(q => Math.abs(no.dot(q.clone().sub(p0))) < 2e-4)) { normals[t] = no; changed = true; break }
        }
        if (normals[t]) break
      }
    }
    if (!changed) break
  }
  const cos = Math.cos((angle * Math.PI) / 180)
  const bvh = (g as any).boundsTree
  const hit = { point: new THREE.Vector3(), distance: 0, faceIndex: 0 }
  const out: EdgeTable = []
  for (const e of edges.values()) {
    const ns = e.tris.map(t => normals[t])
    if (ns.some(x => !x)) {
      // A sliver that lies in no neighbouring plane: only its real neighbour's crease can matter, and that edge
      // is drawn from the other side; skip it.
      continue
    }
    if (e.tris.length === 2) {
      const [n1, n2] = ns as THREE.Vector3[]
      out.push({ a: e.a, b: e.b, n1, n2, crease: n1.dot(n2) < cos })
    } else if (e.tris.length === 1) {
      // Just past the edge, away from its own triangle: is there more of the same flat face?
      const nrm = ns[0]!
      const along = e.b.clone().sub(e.a)
      const mid = e.a.clone().add(e.b).multiplyScalar(0.5)
      const away = nrm.clone().cross(along).normalize()
      if (away.dot(e.third.clone().sub(mid)) > 0) away.negate()
      const r = bvh?.closestPointToPoint(mid.addScaledVector(away, 2e-3), hit)
      // The face found there (a sliver's own normal is good enough to tell a flat continuation from a corner).
      const fn = r ? normals[r.faceIndex] ?? verts[r.faceIndex][1].clone().sub(verts[r.faceIndex][0]).cross(verts[r.faceIndex][2].clone().sub(verts[r.faceIndex][0])).normalize() : null
      const seam = r && r.distance < 1e-4 && Math.abs(fn!.dot(nrm)) > 0.999
      if (!seam) out.push({ a: e.a, b: e.b, n1: nrm, n2: null, crease: true })
    } else {
      // Three or more faces on one edge (overlapping seams): a crease only if they don't all lie flat together.
      const flat = (ns as THREE.Vector3[]).every(x => Math.abs(x.dot(ns[0]!)) > cos)
      if (!flat) out.push({ a: e.a, b: e.b, n1: ns[0]!, n2: null, crease: true })
    }
  }
  return out
}

/** Edge tables of parts' own shapes, kept while the shape is in use (views of one design share them). */
const tables = new WeakMap<THREE.BufferGeometry, Map<number, EdgeTable>>()
function localTable(g: THREE.BufferGeometry, angle: number): EdgeTable {
  let byAngle = tables.get(g)
  if (!byAngle) tables.set(g, (byAngle = new Map()))
  let t = byAngle.get(angle)
  if (!t) {
    const c = g.clone()
    c.computeBoundsTree()
    t = edgeTable(c, angle)
    c.disposeBoundsTree()
    c.dispose()
    byAngle.set(angle, t)
  }
  return t
}

/** The edges to draw from one direction: creases and open edges, plus silhouettes (where the surface turns away). */
function edgesFacing(t: EdgeTable, dir: THREE.Vector3, m?: THREE.Matrix4): Float32Array {
  const nm = m ? new THREE.Matrix3().getNormalMatrix(m) : null
  const out: number[] = []
  for (const e of t) {
    let keep = e.crease
    if (!keep && e.n2) {
      const d1 = (nm ? e.n1.clone().applyMatrix3(nm) : e.n1).dot(dir), d2 = (nm ? e.n2.clone().applyMatrix3(nm) : e.n2).dot(dir)
      keep = (d1 > 1e-6 && d2 < -1e-6) || (d1 < -1e-6 && d2 > 1e-6)
    }
    if (!keep) continue
    const a = m ? e.a.clone().applyMatrix4(m) : e.a, b = m ? e.b.clone().applyMatrix4(m) : e.b
    out.push(a.x, a.y, a.z, b.x, b.y, b.z)
  }
  return new Float32Array(out)
}
