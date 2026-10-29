import * as THREE from 'three'
import type { Pt } from '../../sketch/types'

/** A shaped board: its outline (with cutouts) pushed up through its thickness. Local coordinates, z from 0 to thickness. */
export function extrudeOutline(shape: { outer: Pt[]; holes: Pt[][] }, thickness: number): THREE.BufferGeometry {
  const s = new THREE.Shape(shape.outer.map(p => new THREE.Vector2(p.x, p.y)))
  for (const h of shape.holes) s.holes.push(new THREE.Path(h.map(p => new THREE.Vector2(p.x, p.y))))
  const g = new THREE.ExtrudeGeometry(s, { depth: thickness, bevelEnabled: false, curveSegments: 1 })
  // CSG needs plain indexed-free geometry with matching attributes; drop the extrude's UV groups.
  g.clearGroups()
  return g
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
