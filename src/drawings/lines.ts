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
export type Lines = { segs: Seg[]; min: [number, number]; max: [number, number] }

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
    }
    world.computeBoundsTree()
    const mesh = new THREE.Mesh(world, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }))
    mesh.updateMatrixWorld()
    meshes.push(mesh)
    const e = new THREE.EdgesGeometry(world, opts.angle ?? 20)
    edges.push({ id: b.id, pos: e.getAttribute('position').array as Float32Array })
    e.dispose()
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
  return { segs: mergeSegs(kept), min: [x0, y0], max: [x1, y1] }
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
