// Reference pictures: a photo or scan placed in the 3D view (or behind the drawing board) to design over.
import { newId } from '../model/ids'
import type { Project, Reference, Vec3 } from '../model/types'

export type UV = { u: number; v: number }
export type Plane = Reference['plane']

/** The world directions of a picture's across (u) and up (v) on each plane. */
const AXES: Record<Plane, ['x' | 'y' | 'z', 'x' | 'y' | 'z']> = { front: ['x', 'z'], side: ['y', 'z'], top: ['x', 'y'] }
export const planeAxes = (plane: Plane) => AXES[plane]

export const PLANE_NAMES: Record<Plane, string> = { front: 'Front (upright, facing you)', side: 'Side (upright, facing right)', top: 'Top (flat)' }

export function addReference(p: Project, r: { name: string; dataUrl: string; aspect: number; plane: Plane }): { project: Project; id: string } {
  const id = newId('p')
  const width = 24
  const ref: Reference = { id, name: r.name, plane: r.plane, dataUrl: r.dataUrl, width, height: Math.round((width / (r.aspect > 0 ? r.aspect : 1)) * 1e4) / 1e4, position: { x: 0, y: 0, z: 0 }, opacity: 0.6 }
  return { project: { ...p, references: [...(p.references ?? []), ref] }, id }
}

export function updateReference(p: Project, id: string, patch: Partial<Omit<Reference, 'id'>>): Project {
  return { ...p, references: (p.references ?? []).map(r => (r.id === id ? { ...r, ...patch } : r)) }
}

export function removeReference(p: Project, id: string): Project {
  const references = (p.references ?? []).filter(r => r.id !== id)
  if (references.length) return { ...p, references }
  const { references: _r, ...rest } = p
  return rest
}

/** A point on the picture (0..1 across and up from its low corner) in the world. */
export function worldAt(ref: Reference, at: UV): Vec3 {
  const [a, b] = AXES[ref.plane]
  const out = { ...ref.position }
  out[a] += at.u * ref.width
  out[b] += at.v * ref.height
  return out
}
/** Where a world point falls on the picture. */
export function uvAt(ref: Reference, w: Vec3): UV {
  const [a, b] = AXES[ref.plane]
  return { u: (w[a] - ref.position[a]) / ref.width, v: (w[b] - ref.position[b]) / ref.height }
}

/** Resizes a picture so the two points are `real` inches apart; its low corner stays put. */
export function scaleReference(p: Project, id: string, a: UV, b: UV, real: number): Project | { error: string } {
  const ref = (p.references ?? []).find(r => r.id === id)
  if (!ref) return { error: 'That picture is gone' }
  const s = scaleBetween({ x: 0, y: 0, width: ref.width, height: ref.height }, { x: a.u * ref.width, y: a.v * ref.height }, { x: b.u * ref.width, y: b.v * ref.height }, real)
  if ('error' in s) return s
  return updateReference(p, id, { width: s.width, height: s.height })
}

/** The same in 2D (the drawing board): scale about the picture's corner so the two points are `real` apart. */
export function scaleBetween<T extends { x: number; y: number; width: number; height: number }>(ref: T, a: { x: number; y: number }, b: { x: number; y: number }, real: number): T | { error: string } {
  if (!(real > 0)) return { error: 'Type the real distance between the two points' }
  const d = Math.hypot(a.x - b.x, a.y - b.y)
  if (d < 1e-9) return { error: 'Pick two different points on the picture' }
  const f = real / d
  const r = (v: number) => Math.round(v * 1e4) / 1e4
  return { ...ref, width: r(ref.width * f), height: r(ref.height * f) }
}
