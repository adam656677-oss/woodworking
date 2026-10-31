// Parts as solids in world space: volume, centre of mass and interference (exact, from the finished shapes).
import * as THREE from 'three'
import { Brush, Evaluator, INTERSECTION } from 'three-bvh-csg'
import { worldBox, type Box } from '../model/geometry'
import { cutGeometry, type Cut } from '../model/joints'
import type { Board, Project, Vec3 } from '../model/types'
import { buildBoardGeometry } from '../ui/three/BoardMesh'
import { boardForm } from '../ui/three/boardForm'
import { densityOf } from './density'
import { modelBox, modelGeometry, modelMatrix } from '../exchange/models'

const evaluator = new Evaluator()
evaluator.useGroups = false
const deg = (d: number) => (d * Math.PI) / 180

export function boardMatrix(b: Board): THREE.Matrix4 {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(deg(b.rotation.x), deg(b.rotation.y), deg(b.rotation.z), 'XYZ'))
  return new THREE.Matrix4().compose(new THREE.Vector3(b.position.x, b.position.y, b.position.z), q, new THREE.Vector3(1, 1, 1))
}

/** Each part's finished shape in its own coordinates (cuts, shapes, turnings, profiles). */
export function localSolids(p: Project): Map<string, THREE.BufferGeometry> {
  const cuts = new Map<string, Cut[]>()
  for (const c of cutGeometry(p)) cuts.set(c.boardId, [...(cuts.get(c.boardId) ?? []), c])
  const out = new Map<string, THREE.BufferGeometry>()
  for (const b of p.boards) {
    const f = boardForm(p, b)
    out.set(b.id, buildBoardGeometry(b, cuts.get(b.id) ?? [], f.shape, f.turned))
  }
  return out
}

/** Volume (cu in) and centroid of a closed mesh, after a transform. */
export function volumeAndCentroid(g: THREE.BufferGeometry, m?: THREE.Matrix4): { volume: number; centroid: Vec3 } {
  const pos = g.getAttribute('position')
  const idx = g.getIndex()
  const n = idx ? idx.count : pos.count
  const v = (i: number) => { const p = new THREE.Vector3().fromBufferAttribute(pos, idx ? idx.getX(i) : i); return m ? p.applyMatrix4(m) : p }
  let vol = 0
  const c = new THREE.Vector3()
  for (let i = 0; i < n; i += 3) {
    const a = v(i), b = v(i + 1), d = v(i + 2)
    const t = a.dot(new THREE.Vector3().crossVectors(b, d)) / 6
    vol += t
    c.addScaledVector(a.clone().add(b).add(d), t / 4)
  }
  if (Math.abs(vol) < 1e-12) return { volume: 0, centroid: { x: 0, y: 0, z: 0 } }
  c.divideScalar(vol)
  return { volume: Math.abs(vol), centroid: { x: c.x, y: c.y, z: c.z } }
}

export type PartWeight = { boardId: string; volume: number; pounds: number; estimated: boolean; centroid: Vec3 }
export type WeightReport = { pounds: number; parts: PartWeight[]; centre: Vec3 | null; estimated: boolean; tipping: string | null }

export function weigh(p: Project, solids = localSolids(p)): WeightReport {
  const parts: PartWeight[] = []
  for (const b of p.boards) {
    const g = solids.get(b.id)
    if (!g) continue
    const { volume, centroid } = volumeAndCentroid(g, boardMatrix(b))
    const species = p.woods.find(w => w.id === b.woodId)?.species ?? ''
    const d = densityOf(species)
    parts.push({ boardId: b.id, volume, pounds: (volume / 1728) * d.lbPerCuFt, estimated: d.estimated, centroid })
  }
  const pounds = parts.reduce((s, x) => s + x.pounds, 0)
  const centre = pounds > 0 ? {
    x: parts.reduce((s, x) => s + x.centroid.x * x.pounds, 0) / pounds,
    y: parts.reduce((s, x) => s + x.centroid.y * x.pounds, 0) / pounds,
    z: parts.reduce((s, x) => s + x.centroid.z * x.pounds, 0) / pounds
  } : null
  let tipping: string | null = null
  if (centre && p.boards.length) {
    const boxes = p.boards.map(worldBox)
    const lo = Math.min(...boxes.map(b => b.min.z)), hi = Math.max(...boxes.map(b => b.max.z))
    const d0 = Math.min(...boxes.map(b => b.min.y)), d1 = Math.max(...boxes.map(b => b.max.y))
    const w0 = Math.min(...boxes.map(b => b.min.x)), w1 = Math.max(...boxes.map(b => b.max.x))
    const h = hi - lo, depth = Math.min(d1 - d0, w1 - w0)
    const share = h > 0 ? (centre.z - lo) / h : 0
    if (share > 0.6 && h > 2 * depth) tipping = `Centre of mass is high — ${Math.round(share * 100)}% of the height; anchor tall pieces to the wall`
  }
  return { pounds, parts, centre, estimated: parts.some(x => x.estimated), tipping }
}

export type Interference = { a: string; b: string; volume: number }
/** Less than this (cu in) shared is touching, not running into each other. */
export const INTERFERENCE_MIN = 0.0005
/** Between parts joined by a cut joint: at least this (cubic inches), or 1% of the space they share. */
export const JOINED_MIN = 0.25

const boxesOverlap = (a: Box, b: Box) =>
  a.min.x < b.max.x - 1e-6 && b.min.x < a.max.x - 1e-6 && a.min.y < b.max.y - 1e-6 && b.min.y < a.max.y - 1e-6 && a.min.z < b.max.z - 1e-6 && b.min.z < a.max.z - 1e-6

/** Pairs of parts that share solid wood, with how much. */
export function interferences(p: Project, solids = localSolids(p)): Interference[] {
  const boxes = new Map(p.boards.map(b => [b.id, worldBox(b)]))
  const brush = (b: Board) => {
    const br = new Brush(solids.get(b.id)!)
    boardMatrix(b).decompose(br.position, br.quaternion, br.scale)
    br.updateMatrixWorld()
    return br
  }
  const out: Interference[] = []
  // Parts joined by a cut joint share many faces exactly; the solid code leaves crumbs along them. The joints'
  // own cuts are checked to share the wood out exactly, so only something bigger counts there.
  const joined = new Set(p.joints.filter(j => j.type === 'joinery').flatMap(j => [`${j.hostBoardId}|${j.partnerBoardId}`, `${j.partnerBoardId}|${j.hostBoardId}`]))
  for (let i = 0; i < p.boards.length; i++) {
    for (let j = i + 1; j < p.boards.length; j++) {
      const A = p.boards[i], B = p.boards[j]
      if (!boxesOverlap(boxes.get(A.id)!, boxes.get(B.id)!)) continue
      const r = evaluator.evaluate(brush(A), brush(B), INTERSECTION) as Brush
      const v = volumeAndCentroid(r.geometry).volume
      const a = boxes.get(A.id)!, b = boxes.get(B.id)!
      const shared = ['x', 'y', 'z'].reduce((k, ax) => k * Math.max(0, Math.min(a.max[ax as 'x'], b.max[ax as 'x']) - Math.max(a.min[ax as 'x'], b.min[ax as 'x'])), 1)
      if (v > (joined.has(`${A.id}|${B.id}`) ? Math.max(JOINED_MIN, shared * 0.01) : INTERFERENCE_MIN)) out.push({ a: A.id, b: B.id, volume: v })
    }
  }
  // Reference models (an appliance, say) count too, unless left out of the checks.
  for (const m of p.models ?? []) {
    if (m.noChecks) continue
    const mb = modelBox(m)
    const near = p.boards.filter(b => boxesOverlap(boxes.get(b.id)!, mb))
    if (!near.length) continue
    const br = new Brush(modelGeometry(m))
    modelMatrix(m).decompose(br.position, br.quaternion, br.scale)
    br.updateMatrixWorld()
    for (const b of near) {
      const r = evaluator.evaluate(brush(b), br, INTERSECTION) as Brush
      const v = volumeAndCentroid(r.geometry).volume
      if (v > INTERFERENCE_MIN) out.push({ a: b.id, b: m.id, volume: v })
    }
  }
  return out
}
