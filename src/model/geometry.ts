// World-space geometry for boards: rotation (Euler XYZ, degrees, about the origin corner) then position.
import type { Board, Vec3 } from './types'

export type Box = { min: Vec3; max: Vec3 }
export type Axis = 'x' | 'y' | 'z'
/** Which world axis a board's local axis points along, and in which direction. */
export type AxisMap = { axis: Axis; sign: 1 | -1 }

const AXES: Axis[] = ['x', 'y', 'z']
const clean = (n: number) => Math.round(n * 1e9) / 1e9 + 0

export function rotateVec(v: Vec3, rotDeg: Vec3): Vec3 {
  const [ax, ay, az] = [rotDeg.x, rotDeg.y, rotDeg.z].map(d => (d * Math.PI) / 180)
  // Matrix R = Rx * Ry * Rz (three.js 'XYZ' order), applied to v.
  let { x, y, z } = v
  // Rz
  ;[x, y] = [x * Math.cos(az) - y * Math.sin(az), x * Math.sin(az) + y * Math.cos(az)]
  // Ry
  ;[x, z] = [x * Math.cos(ay) + z * Math.sin(ay), -x * Math.sin(ay) + z * Math.cos(ay)]
  // Rx
  ;[y, z] = [y * Math.cos(ax) - z * Math.sin(ax), y * Math.sin(ax) + z * Math.cos(ax)]
  return { x: clean(x), y: clean(y), z: clean(z) }
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
  const pts: Vec3[] = []
  for (const x of [0, b.width]) for (const y of [0, b.length]) for (const z of [0, b.thickness]) pts.push(toWorld(b, { x, y, z }))
  const min = { x: Math.min(...pts.map(p => p.x)), y: Math.min(...pts.map(p => p.y)), z: Math.min(...pts.map(p => p.z)) }
  const max = { x: Math.max(...pts.map(p => p.x)), y: Math.max(...pts.map(p => p.y)), z: Math.max(...pts.map(p => p.z)) }
  return { min, max }
}

export function overlap1(aMin: number, aMax: number, bMin: number, bMax: number): number {
  return Math.min(aMax, bMax) - Math.max(aMin, bMin)
}

export { AXES }
