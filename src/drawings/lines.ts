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
  const meshes: THREE.Mesh[] = []
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
    world.computeBoundsTree()
    const mesh = new THREE.Mesh(world, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }))
    mesh.updateMatrixWorld()
    meshes.push(mesh)
    edges.push({ id: b.id, pos: featureEdges(world, opts.angle ?? 20) })
  }
  const dir = new THREE.Vector3(view.toViewer.x, view.toViewer.y, view.toViewer.z).normalize()
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
  for (const m of meshes) { m.geometry.disposeBoundsTree(); m.geometry.dispose() }
  const kept = opts.hidden === false ? segs.filter(s => !s.hidden) : segs
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const s of kept) for (const q of [s.a, s.b]) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]) }
  if (!kept.length) { x0 = y0 = x1 = y1 = 0 }
  return { segs: mergeSegs(kept), min: [x0, y0], max: [x1, y1], ...(opts.clip ? { cut: cutTris.map(t => t.map(P)) } : {}) }
}

/** Joins collinear pieces end to end and drops duplicates (two faces share an edge). */
function mergeSegs(segs: Seg[]): Seg[] {
  const key = (s: Seg) => { const [p, q] = [s.a, s.b].sort((u, v) => u[0] - v[0] || u[1] - v[1]); return `${s.hidden ? 1 : 0}:${p.map(v => v.toFixed(4))}:${q.map(v => v.toFixed(4))}` }
  const seen = new Set<string>()
  const out: Seg[] = []
  // Visible lines win over hidden lines in the same place.
  const vis = new Set(segs.filter(s => !s.hidden).map(s => key({ ...s, hidden: false })))
  for (const s of segs) {
    const k = key(s)
    if (seen.has(k)) continue
    if (s.hidden && vis.has(key({ ...s, hidden: false }))) continue
    seen.add(k)
    out.push(s)
  }
  return out
}

/**
 * The edges worth drawing: where faces meet at more than `angle` degrees, and open edges — except open edges that
 * are only a seam in a flat face (cut-up meshes have T-junctions, where one face's edge runs along another's side).
 * The geometry must have its bounds tree built.
 */
function featureEdges(g: THREE.BufferGeometry, angle: number): Float32Array {
  const pos = g.getAttribute('position'), idx = g.getIndex()
  const n = idx ? idx.count : pos.count
  const vi = (i: number) => (idx ? idx.getX(i) : i)
  const P = (i: number) => new THREE.Vector3().fromBufferAttribute(pos, vi(i))
  const key = (v: THREE.Vector3) => `${Math.round(v.x * 1e4)},${Math.round(v.y * 1e4)},${Math.round(v.z * 1e4)}`
  const normals: THREE.Vector3[] = []
  const edges = new Map<string, { a: THREE.Vector3; b: THREE.Vector3; tris: number[]; third: THREE.Vector3 }>()
  for (let t = 0; t * 3 + 2 < n; t++) {
    const v = [P(t * 3), P(t * 3 + 1), P(t * 3 + 2)]
    const nrm = v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0]))
    const len = nrm.length()
    normals.push(len > 1e-12 ? nrm.divideScalar(len) : nrm)
    if (len < 1e-9) continue
    for (let k = 0; k < 3; k++) {
      const a = v[k], b = v[(k + 1) % 3]
      const ka = key(a), kb = key(b)
      if (ka === kb) continue
      const kk = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`
      const e = edges.get(kk)
      if (e) e.tris.push(t)
      else edges.set(kk, { a, b, tris: [t], third: v[(k + 2) % 3] })
    }
  }
  const cos = Math.cos((angle * Math.PI) / 180)
  const bvh = (g as any).boundsTree
  const out: number[] = []
  const hit = { point: new THREE.Vector3(), distance: 0, faceIndex: 0 }
  for (const e of edges.values()) {
    let keep: boolean
    if (e.tris.length === 2) keep = normals[e.tris[0]].dot(normals[e.tris[1]]) < cos
    else if (e.tris.length === 1 && bvh) {
      // Just past the edge, away from its own triangle: is there more of the same flat face?
      const nrm = normals[e.tris[0]]
      const dir = e.b.clone().sub(e.a)
      const mid = e.a.clone().add(e.b).multiplyScalar(0.5)
      const away = nrm.clone().cross(dir).normalize()
      if (away.dot(e.third.clone().sub(mid)) > 0) away.negate()
      const q = mid.addScaledVector(away, 2e-3)
      const r = bvh.closestPointToPoint(q, hit)
      keep = !(r && r.distance < 1e-4 && Math.abs(normals[r.faceIndex]?.dot(nrm) ?? 0) > 0.9999)
    } else keep = true
    if (keep) out.push(e.a.x, e.a.y, e.a.z, e.b.x, e.b.y, e.b.z)
  }
  return new Float32Array(out)
}
