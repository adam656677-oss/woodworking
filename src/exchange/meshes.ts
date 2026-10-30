// Each part's finished solid in world inches, as plain triangles — the common input of every 3D writer.
import * as THREE from 'three'
import { ancestry } from '../assemblies/ops'
import { boardMatrix, localSolids } from '../checks/solids'
import type { Board, Project } from '../model/types'

export type PartMesh = {
  id: string
  name: string
  /** Groups it's in, outermost first (for formats that nest). */
  path: string[]
  woodId: string
  /** x, y, z of each corner; three corners per triangle (world inches). */
  positions: Float32Array
}

/** Every part (or just these), finished shapes and all, placed in the world. */
export function partMeshes(p: Project, ids?: string[]): PartMesh[] {
  const boards = ids ? p.boards.filter(b => ids.includes(b.id)) : p.boards
  const solids = localSolids({ ...p, boards: p.boards })
  return boards.map(b => ({ id: b.id, name: b.name, path: [...ancestry(p, b.groupId)].reverse().map(g => g.name), woodId: b.woodId, positions: worldTriangles(solids.get(b.id)!, b) }))
}

export function worldTriangles(g: THREE.BufferGeometry, b: Board): Float32Array {
  const flat = g.index ? g.toNonIndexed() : g
  const pos = (flat.getAttribute('position') as THREE.BufferAttribute).clone()
  pos.applyMatrix4(boardMatrix(b))
  return new Float32Array(pos.array as ArrayLike<number>)
}

/** Unique names for parts in files: Side, Side_2, Shelf (spaces and marks become _). */
export function uniqueNames(names: string[]): string[] {
  const seen = new Map<string, number>()
  return names.map(n => {
    const base = n.trim().replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'Part'
    const k = (seen.get(base) ?? 0) + 1
    seen.set(base, k)
    return k === 1 ? base : `${base}_${k}`
  })
}

export type Bounds = { min: [number, number, number]; max: [number, number, number] }
export function boundsOf(arrays: Float32Array[]): Bounds {
  const min: [number, number, number] = [Infinity, Infinity, Infinity], max: [number, number, number] = [-Infinity, -Infinity, -Infinity]
  for (const a of arrays) for (let i = 0; i < a.length; i += 3) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], a[i + k]); max[k] = Math.max(max[k], a[i + k]) }
  return { min, max }
}

/** A triangle's unit normal (zero for a degenerate one). */
export function normalOf(a: Float32Array, i: number): [number, number, number] {
  const ux = a[i + 3] - a[i], uy = a[i + 4] - a[i + 1], uz = a[i + 5] - a[i + 2]
  const vx = a[i + 6] - a[i], vy = a[i + 7] - a[i + 1], vz = a[i + 8] - a[i + 2]
  const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx
  const l = Math.hypot(nx, ny, nz)
  return l > 0 ? [nx / l, ny / l, nz / l] : [0, 0, 0]
}

/** Shared corners: a vertex list and triangle indices (corners within 1e-6" are the same). */
export function weld(a: Float32Array): { vertices: number[]; indices: number[] } {
  const map = new Map<string, number>()
  const vertices: number[] = [], indices: number[] = []
  for (let i = 0; i < a.length; i += 3) {
    const k = `${Math.round(a[i] * 1e5)},${Math.round(a[i + 1] * 1e5)},${Math.round(a[i + 2] * 1e5)}`
    let idx = map.get(k)
    if (idx === undefined) { idx = vertices.length / 3; map.set(k, idx); vertices.push(a[i], a[i + 1], a[i + 2]) }
    indices.push(idx)
  }
  return { vertices, indices }
}
