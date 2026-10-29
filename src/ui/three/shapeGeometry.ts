import * as THREE from 'three'
import type { Pt } from '../../sketch/types'
import { reachAt } from './profileCutter'

/** A shaped board: its outline (with cutouts) pushed up through its thickness. Local coordinates, z from 0 to thickness. */
export type OutlineProfile = { face: 'top' | 'bottom'; section: Pt[]; size: number }

const LAYERS = 8

function slab(shape: { outer: Pt[]; holes: Pt[][] }, z0: number, z1: number): THREE.BufferGeometry {
  const s = new THREE.Shape(shape.outer.map(p => new THREE.Vector2(p.x, p.y)))
  for (const h of shape.holes) s.holes.push(new THREE.Path(h.map(p => new THREE.Vector2(p.x, p.y))))
  const g = new THREE.ExtrudeGeometry(s, { depth: z1 - z0, bevelEnabled: false, curveSegments: 1 })
  g.translate(0, 0, z0)
  // CSG needs geometry without the extrude's material groups.
  g.clearGroups()
  return g.index ? g.toNonIndexed() : g
}

/** Moves a closed outline inward by d (holes grow by d): each corner along its bisector. */
export function insetPolygon(poly: Pt[], d: number): Pt[] {
  const n = poly.length
  let area = 0
  for (let i = 0; i < n; i++) { const p = poly[i], q = poly[(i + 1) % n]; area += p.x * q.y - q.x * p.y }
  const ccw = area > 0 ? 1 : -1
  return poly.map((p, i) => {
    const a = poly[(i - 1 + n) % n], c = poly[(i + 1) % n]
    const n1 = norm({ x: -(p.y - a.y) * ccw, y: (p.x - a.x) * ccw })
    const n2 = norm({ x: -(c.y - p.y) * ccw, y: (c.x - p.x) * ccw })
    const m = norm({ x: n1.x + n2.x, y: n1.y + n2.y })
    const cos = Math.max(0.25, m.x * n1.x + m.y * n1.y)
    return { x: p.x + (m.x * d) / cos, y: p.y + (m.y * d) / cos }
  })
}
function norm(v: Pt): Pt { const l = Math.hypot(v.x, v.y) || 1; return { x: v.x / l, y: v.y / l } }

/**
 * A shaped board: its outline (with cutouts) pushed up through its thickness. Local coordinates, z from 0 to thickness.
 * An outline profile is built as thin layers, each set in by how far the router bit reaches at that depth.
 */
export function extrudeOutline(shape: { outer: Pt[]; holes: Pt[][] }, thickness: number, profiles: OutlineProfile[] = []): THREE.BufferGeometry {
  const top = profiles.find(p => p.face === 'top'), bottom = profiles.find(p => p.face === 'bottom')
  const z0 = bottom ? bottom.size : 0, z1 = thickness - (top ? top.size : 0)
  if (!top && !bottom) return slab(shape, 0, thickness)
  const parts: THREE.BufferGeometry[] = [slab(shape, z0, z1)]
  const layer = (p: OutlineProfile, i: number) => {
    const t = p.size / LAYERS
    const depth = (i + 0.5) * t
    const d = reachAt(p.section, depth)
    const inset = { outer: insetPolygon(shape.outer, d), holes: shape.holes.map(h => insetPolygon(h, d)) }
    return p.face === 'top' ? slab(inset, thickness - (i + 1) * t, thickness - i * t) : slab(inset, i * t, (i + 1) * t)
  }
  for (const p of [top, bottom]) if (p) for (let i = 0; i < LAYERS; i++) parts.push(layer(p, i))
  return mergeGeometries(parts)
}

function mergeGeometries(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const names = ['position', 'normal', 'uv'] as const
  const out = new THREE.BufferGeometry()
  for (const name of names) {
    const arrays = parts.map(g => g.getAttribute(name).array as Float32Array)
    const total = arrays.reduce((s, a) => s + a.length, 0)
    const merged = new Float32Array(total)
    let off = 0
    for (const a of arrays) { merged.set(a, off); off += a.length }
    out.setAttribute(name, new THREE.BufferAttribute(merged, name === 'uv' ? 2 : 3))
  }
  return out
}

/** Area of the faces looking straight up (+z): for checking the shape came out right. */
export function upFacingArea(g: THREE.BufferGeometry): number {
  const pos = g.getAttribute('position')
  const idx = g.getIndex()
  const n = idx ? idx.count : pos.count
  const v = (i: number) => new THREE.Vector3().fromBufferAttribute(pos, idx ? idx.getX(i) : i)
  let area = 0
  for (let i = 0; i < n; i += 3) {
    const a = v(i), b = v(i + 1), c = v(i + 2)
    const cross = new THREE.Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a))
    if (cross.z > 0 && Math.abs(cross.z) / cross.length() > 0.999) area += cross.length() / 2
  }
  return area
}
