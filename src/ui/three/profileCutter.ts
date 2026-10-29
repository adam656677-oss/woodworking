import * as THREE from 'three'
import { Brush } from 'three-bvh-csg'
import type { Board } from '../../model/types'
import type { ProfileCut } from '../../shaping/edges'
import type { Pt } from '../../sketch/types'

const E = 0.01

/** The section with a little margin past the corner, so the cut leaves clean faces. */
function padded(section: Pt[]): Pt[] {
  const [, first] = section
  const last = section[section.length - 1]
  return [{ x: -E, y: -E }, { x: first.x, y: -E }, ...section.slice(1), { x: -E, y: last.y }]
}

type V = { x: number; y: number; z: number }

/** A profile's cutter: its cross-section run along the edge, a hair past each end. */
export function profileBrush(cut: ProfileCut, b: Board): Brush {
  const s = new THREE.Shape(padded(cut.section).map(p => new THREE.Vector2(p.x, p.y)))
  const g = new THREE.ExtrudeGeometry(s, { depth: cut.length + 2 * E, bevelEnabled: false, curveSegments: 1 })
  g.clearGroups()
  const V: V = cut.face === 'top' ? { x: 0, y: 0, z: -1 } : { x: 0, y: 0, z: 1 }
  const z0 = cut.face === 'top' ? b.thickness : 0
  const U: V = cut.side === 'left' ? { x: 1, y: 0, z: 0 } : cut.side === 'right' ? { x: -1, y: 0, z: 0 } : cut.side === 'start' ? { x: 0, y: 1, z: 0 } : { x: 0, y: -1, z: 0 }
  let A: V = cut.side === 'left' || cut.side === 'right' ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 }
  let O: V = {
    x: cut.side === 'right' ? b.width : 0,
    y: cut.side === 'end' ? b.length : 0,
    z: z0
  }
  // Start a hair before the edge's start.
  O = { x: O.x - A.x * E, y: O.y - A.y * E, z: O.z }
  // Keep the cutter's faces pointing outward: run it backwards if the axes are left-handed.
  const det = U.x * (V.y * A.z - V.z * A.y) - U.y * (V.x * A.z - V.z * A.x) + U.z * (V.x * A.y - V.y * A.x)
  if (det < 0) {
    O = { x: O.x + A.x * (cut.length + 2 * E), y: O.y + A.y * (cut.length + 2 * E), z: O.z }
    A = { x: -A.x, y: -A.y, z: -A.z }
  }
  const m = new THREE.Matrix4().set(U.x, V.x, A.x, O.x, U.y, V.y, A.y, O.y, U.z, V.z, A.z, O.z, 0, 0, 0, 1)
  g.applyMatrix4(m)
  const brush = new Brush(g)
  brush.updateMatrixWorld()
  return brush
}

/** How far a profile reaches into the face at a given depth (from the section). */
export function reachAt(section: Pt[], v: number): number {
  let best = 0
  for (let i = 0, j = section.length - 1; i < section.length; j = i++) {
    const a = section[i], c = section[j]
    if ((a.y - v) * (c.y - v) <= 0 && a.y !== c.y) best = Math.max(best, a.x + ((c.x - a.x) * (v - a.y)) / (c.y - a.y))
  }
  return best
}
