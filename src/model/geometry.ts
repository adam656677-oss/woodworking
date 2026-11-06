// World-space geometry for boards: rotation (Euler XYZ, degrees, about the origin corner) then position.
import type { Board, Vec3 } from './types'

export type Box = { min: Vec3; max: Vec3 }
export type Axis = 'x' | 'y' | 'z'
/** Which world axis a board's local axis points along, and in which direction. */
export type AxisMap = { axis: Axis; sign: 1 | -1 }

const AXES: Axis[] = ['x', 'y', 'z']
const clean = (n: number) => Math.round(n * 1e9) / 1e9 + 0

/** The sines and cosines of a board's rotation, worked out once (a rotation is applied to many points). */
type Trig = { sx: number; cx: number; sy: number; cy: number; sz: number; cz: number }
function trigOf(rotDeg: Vec3): Trig {
  const ax = (rotDeg.x * Math.PI) / 180, ay = (rotDeg.y * Math.PI) / 180, az = (rotDeg.z * Math.PI) / 180
  return { sx: Math.sin(ax), cx: Math.cos(ax), sy: Math.sin(ay), cy: Math.cos(ay), sz: Math.sin(az), cz: Math.cos(az) }
}

/** Matrix R = Rx * Ry * Rz (three.js 'XYZ' order) applied to a point; same arithmetic whichever caller asks. */
function rotate(x0: number, y0: number, z0: number, t: Trig, out: Vec3): Vec3 {
  // Rz
  const x1 = x0 * t.cz - y0 * t.sz
  const y1 = x0 * t.sz + y0 * t.cz
  // Ry
  const x2 = x1 * t.cy + z0 * t.sy
  const z2 = -x1 * t.sy + z0 * t.cy
  // Rx
  const y3 = y1 * t.cx - z2 * t.sx
  const z3 = y1 * t.sx + z2 * t.cx
  out.x = clean(x2)
  out.y = clean(y3)
  out.z = clean(z3)
  return out
}

export function rotateVec(v: Vec3, rotDeg: Vec3): Vec3 {
  return rotate(v.x, v.y, v.z, trigOf(rotDeg), { x: 0, y: 0, z: 0 })
}

/** Board-local point → world point. */
export function toWorld(b: Board, p: Vec3): Vec3 {
  const r = rotateVec(p, b.rotation)
  return { x: clean(r.x + b.position.x), y: clean(r.y + b.position.y), z: clean(r.z + b.position.z) }
}

export function isAxisAligned(b: Board): boolean {
  return [b.rotation.x, b.rotation.y, b.rotation.z].every(d => Math.abs(d / 90 - Math.round(d / 90)) < 1e-9)
}

/** Where local x (width), y (length) and z (thickness) point in the world. Only for axis-aligned boards. */
export function localAxes(b: Board): { width: AxisMap; length: AxisMap; thickness: AxisMap } {
  const map = (v: Vec3): AxisMap => {
    const r = rotateVec(v, b.rotation)
    const axis = AXES.reduce((best, a) => (Math.abs(r[a]) > Math.abs(r[best]) ? a : best), 'x' as Axis)
    return { axis, sign: r[axis] >= 0 ? 1 : -1 }
  }
  return { width: map({ x: 1, y: 0, z: 0 }), length: map({ x: 0, y: 1, z: 0 }), thickness: map({ x: 0, y: 0, z: 1 }) }
}

/** Axis-aligned bounding box of the board in world space (long-point size). */
export function worldBox(b: Board): Box {
  const t = trigOf(b.rotation)
  const r = { x: 0, y: 0, z: 0 }
  let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity
  for (let i = 0; i < 8; i++) {
    // Corners in the same order as before: x slowest, z fastest.
    rotate(i & 4 ? b.width : 0, i & 2 ? b.length : 0, i & 1 ? b.thickness : 0, t, r)
    const x = clean(r.x + b.position.x), y = clean(r.y + b.position.y), z = clean(r.z + b.position.z)
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
    if (z < minZ) minZ = z
    if (z > maxZ) maxZ = z
  }
  return { min: { x: minX, y: minY, z: minZ }, max: { x: maxX, y: maxY, z: maxZ } }
}

export function overlap1(aMin: number, aMax: number, bMin: number, bMax: number): number {
  return Math.min(aMax, bMax) - Math.max(aMin, bMin)
}

export { AXES }

/** World point → board-local point (inverse of toWorld). */
export function toLocal(b: Board, p: Vec3): Vec3 {
  const v = { x: p.x - b.position.x, y: p.y - b.position.y, z: p.z - b.position.z }
  const [ax, ay, az] = [b.rotation.x, b.rotation.y, b.rotation.z].map(d => (-d * Math.PI) / 180)
  let { x, y, z } = v
  // Inverse of Rx*Ry*Rz is Rz^-1 * Ry^-1 * Rx^-1, so apply Rx^-1 first.
  ;[y, z] = [y * Math.cos(ax) - z * Math.sin(ax), y * Math.sin(ax) + z * Math.cos(ax)]
  ;[x, z] = [x * Math.cos(ay) + z * Math.sin(ay), -x * Math.sin(ay) + z * Math.cos(ay)]
  ;[x, y] = [x * Math.cos(az) - y * Math.sin(az), x * Math.sin(az) + y * Math.cos(az)]
  return { x: clean(x), y: clean(y), z: clean(z) }
}

/** Axis-aligned box of `other` expressed in `b`'s local coordinates. */
export function boxInLocal(b: Board, other: Box): Box {
  const pts: Vec3[] = []
  for (const x of [other.min.x, other.max.x]) for (const y of [other.min.y, other.max.y]) for (const z of [other.min.z, other.max.z]) pts.push(toLocal(b, { x, y, z }))
  return {
    min: { x: Math.min(...pts.map(p => p.x)), y: Math.min(...pts.map(p => p.y)), z: Math.min(...pts.map(p => p.z)) },
    max: { x: Math.max(...pts.map(p => p.x)), y: Math.max(...pts.map(p => p.y)), z: Math.max(...pts.map(p => p.z)) }
  }
}

/** Which face of the host ('top' = local +z) looks toward the partner. */
export function faceToward(host: Board, partner: Board): 'top' | 'bottom' {
  const t = localAxes(host).thickness
  const hb = worldBox(host)
  const pb = worldBox(partner)
  const hostMid = (hb.min[t.axis] + hb.max[t.axis]) / 2
  const partnerMid = (pb.min[t.axis] + pb.max[t.axis]) / 2
  return (partnerMid - hostMid) * t.sign >= 0 ? 'top' : 'bottom'
}
