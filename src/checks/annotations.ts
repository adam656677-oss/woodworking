// Dimensions and notes kept on the model (points in world inches).
import { newId } from '../model/ids'
import type { OpError } from '../model/ops'
import type { Annotation, Project, Vec3 } from '../model/types'

const list = (p: Project) => p.annotations ?? []
const withList = (p: Project, a: Annotation[]): Project => {
  if (a.length) return { ...p, annotations: a }
  const { annotations: _a, ...rest } = p
  return rest
}
const round = (v: Vec3): Vec3 => ({ x: Math.round(v.x * 1e6) / 1e6, y: Math.round(v.y * 1e6) / 1e6, z: Math.round(v.z * 1e6) / 1e6 })

export function addDimension(p: Project, a: Vec3, b: Vec3, label?: string): { project: Project; id: string } | OpError {
  if (Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) < 1e-6) return { error: 'Pick two different points' }
  const id = newId('k')
  const ann: Annotation = { id, kind: 'dimension', a: round(a), b: round(b), ...(label?.trim() ? { label: label.trim() } : {}) }
  return { project: withList(p, [...list(p), ann]), id }
}

export function addNote(p: Project, at: Vec3, text: string): { project: Project; id: string } | OpError {
  if (!text.trim()) return { error: 'Type the note' }
  const id = newId('k')
  return { project: withList(p, [...list(p), { id, kind: 'note', at: round(at), text: text.trim() }]), id }
}

/** A note's text, or a dimension's label (empty clears the label). */
export function editAnnotation(p: Project, id: string, text: string): Project | OpError {
  const a = list(p).find(x => x.id === id)
  if (!a) return p
  if (a.kind === 'note' && !text.trim()) return { error: 'Type the note' }
  return withList(p, list(p).map(x => {
    if (x.id !== id) return x
    if (x.kind === 'note') return { ...x, text: text.trim() }
    const { label: _l, ...rest } = x
    return text.trim() ? { ...rest, label: text.trim() } : rest
  }))
}

export function removeAnnotation(p: Project, id: string): Project {
  return withList(p, list(p).filter(x => x.id !== id))
}

export const dimensionLength = (a: { a: Vec3; b: Vec3 }) => Math.hypot(a.a.x - a.b.x, a.a.y - a.b.y, a.a.z - a.b.z)
