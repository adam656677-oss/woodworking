// Reference models: outside 3D models placed in the design to work around (not parts — no cut list or weight).
import * as THREE from 'three'
import { deflateSync, inflateSync } from 'fflate'
import { newId } from '../model/ids'
import type { Project, RefModel, Vec3 } from '../model/types'
import { UNIT_SCALE, type FileUnit, type ReadResult } from './readers'

const PREFIX = 'data:application/x-aa-mesh;base64,'

function toBase64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}
function fromBase64(b64: string): Uint8Array {
  const s = atob(b64)
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}

/** Triangles (inches) packed small for the project file. */
export function packMesh(positions: Float32Array): string {
  return PREFIX + toBase64(deflateSync(new Uint8Array(positions.buffer, positions.byteOffset, positions.byteLength), { level: 6 }))
}
const cache = new Map<string, Float32Array>()
export function unpackMesh(data: string): Float32Array {
  const hit = cache.get(data)
  if (hit) return hit
  if (!data.startsWith(PREFIX)) throw new Error('not a packed mesh')
  const bytes = inflateSync(fromBase64(data.slice(PREFIX.length)))
  const out = new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4)
  if (cache.size > 20) cache.delete(cache.keys().next().value!)
  cache.set(data, out)
  return out
}
export const isPackedMesh = (s: unknown) => typeof s === 'string' && s.startsWith(PREFIX)

/** Adds a read model, converted to inches with its low corner at the origin, placed at `at`. */
export function addModel(p: Project, name: string, format: string, r: ReadResult, unit: FileUnit, at: Vec3 = { x: 0, y: 0, z: 0 }): { project: Project; id: string } {
  const s = UNIT_SCALE[unit]
  const a = new Float32Array(r.positions.length)
  const min = [Infinity, Infinity, Infinity]
  for (let i = 0; i < a.length; i++) { a[i] = r.positions[i] * s; min[i % 3] = Math.min(min[i % 3], a[i]) }
  for (let i = 0; i < a.length; i++) a[i] -= min[i % 3]
  const id = newId('p')
  const m: RefModel = { id, name, format, data: packMesh(a), position: at, rotation: { x: 0, y: 0, z: 0 }, scale: 1, opacity: 0.85 }
  return { project: { ...p, models: [...(p.models ?? []), m] }, id }
}
export function updateModel(p: Project, id: string, patch: Partial<Omit<RefModel, 'id' | 'data'>>): Project {
  return { ...p, models: (p.models ?? []).map(m => (m.id === id ? { ...m, ...patch } : m)) }
}
export function removeModel(p: Project, id: string): Project {
  const models = (p.models ?? []).filter(m => m.id !== id)
  if (models.length) return { ...p, models }
  const { models: _m, ...rest } = p
  return rest
}
/** A model's size in inches (as drawn, before turning). */
export function modelSize(m: RefModel): Vec3 {
  const a = unpackMesh(m.data)
  const max = [0, 0, 0]
  for (let i = 0; i < a.length; i++) max[i % 3] = Math.max(max[i % 3], a[i])
  return { x: max[0] * m.scale, y: max[1] * m.scale, z: max[2] * m.scale }
}

const RAD = Math.PI / 180
/** Where a model sits: turned (degrees, as parts are) and scaled about its origin, then moved to its position. */
export function modelMatrix(m: RefModel): THREE.Matrix4 {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(m.rotation.x * RAD, m.rotation.y * RAD, m.rotation.z * RAD, 'XYZ'))
  return new THREE.Matrix4().compose(new THREE.Vector3(m.position.x, m.position.y, m.position.z), q, new THREE.Vector3(m.scale, m.scale, m.scale))
}
const geoms = new Map<string, THREE.BufferGeometry>()
/** A model's triangles as geometry (with normals and empty UVs, as part geometry has, so they can be cut together). */
export function modelGeometry(m: RefModel): THREE.BufferGeometry {
  const hit = geoms.get(m.data)
  if (hit) return hit
  const g = new THREE.BufferGeometry()
  const a = unpackMesh(m.data)
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(a), 3))
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array((a.length / 3) * 2), 2))
  g.computeVertexNormals()
  if (geoms.size > 20) { const k = geoms.keys().next().value!; geoms.get(k)?.dispose(); geoms.delete(k) }
  geoms.set(m.data, g)
  return g
}
/** The model's box in the world. */
export function modelBox(m: RefModel): { min: Vec3; max: Vec3 } {
  const g = modelGeometry(m)
  g.computeBoundingBox()
  const b = g.boundingBox!.clone().applyMatrix4(modelMatrix(m))
  return { min: { x: b.min.x, y: b.min.y, z: b.min.z }, max: { x: b.max.x, y: b.max.y, z: b.max.z } }
}
