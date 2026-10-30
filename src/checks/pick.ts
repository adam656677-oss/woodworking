// Where a click lands on the model, allowing for the section view and the exploded view.
import type { Box } from '../model/geometry'
import type { Vec3 } from '../model/types'

export type PlaneLike = { normal: Vec3; constant: number }
export type RayLike = { origin: Vec3; direction: Vec3 }

const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z
const EPS = 1e-6

/**
 * The model point a click on a part means, or null when the click only touched the part's cut-away half (then the
 * next part along the ray should take it).
 * - In a section, a hit on the hidden side is moved to where the ray crosses the cut — if the part is there.
 * - In the exploded view, the part's offset is taken back off, so kept dimensions and notes sit on the real model.
 * `box` is the part's box as drawn (with its explode offset).
 */
export function pickOnModel(point: Vec3, ray: RayLike, box: Box, plane: PlaneLike | undefined, offset: Vec3 | undefined): Vec3 | null {
  let at = point
  if (plane && dot(plane.normal, point) + plane.constant < -EPS) {
    const denom = dot(plane.normal, ray.direction)
    if (Math.abs(denom) < 1e-12) return null
    const t = -(dot(plane.normal, ray.origin) + plane.constant) / denom
    if (t < 0) return null
    const q = { x: ray.origin.x + ray.direction.x * t, y: ray.origin.y + ray.direction.y * t, z: ray.origin.z + ray.direction.z * t }
    const inside = (['x', 'y', 'z'] as const).every(a => q[a] >= box.min[a] - EPS && q[a] <= box.max[a] + EPS)
    if (!inside) return null
    at = q
  }
  const r = (v: number) => Math.round(v * 1e9) / 1e9 + 0
  return offset ? { x: r(at.x - offset.x), y: r(at.y - offset.y), z: r(at.z - offset.z) } : { x: r(at.x), y: r(at.y), z: r(at.z) }
}
