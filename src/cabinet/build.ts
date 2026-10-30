// Shared pieces for the door, drawer and face-frame makers.
import { groupsOf } from '../assemblies/ops'
import { boxInLocal, faceToward, rotateVec, toWorld, worldBox } from '../model/geometry'
import { newId } from '../model/ids'
import type { Board, Group, GrooveParams, Joint, Motion, Project, Vec3, Wood } from '../model/types'
import { snap64 } from '../model/units'

/** An opening: its lower-left-front corner and size (depth for drawers). */
export type Opening = { x: number; y: number; z: number; width: number; height: number; depth?: number }

export const sixteenth = 1 / 16

export function woodById(p: Project, id: string): Wood | { error: string } {
  return p.woods.find(w => w.id === id) ?? { error: `There's no wood "${id}" in this project` }
}

/** "Door 3": the next free number for a name. */
export function nextName(p: Project, base: string): string {
  const used = new Set(groupsOf(p).map(g => g.name))
  let n = 1
  while (used.has(`${base} ${n}`)) n++
  return `${base} ${n}`
}

/** Adds boards and joints as one new group (with its motion). */
export function addAsGroup(p: Project, boards: Board[], joints: Joint[], name: string, motion?: Motion, parentId?: string): { project: Project; id: string } {
  const id = newId('g')
  const group: Group = { id, name, ...(parentId ? { parentId } : {}), ...(motion ? { motion } : {}) }
  return {
    project: { ...p, boards: [...p.boards, ...boards.map(b => ({ ...b, groupId: id }))], joints: [...p.joints, ...joints], groups: [...groupsOf(p), group] },
    id
  }
}

/** The world direction of a board's local axis. */
export const dirOf = (b: Board, local: Vec3) => rotateVec(local, b.rotation)

/** The board's edge ('left' = local x 0, 'right' = local x width) nearer a world point. */
export function edgeToward(b: Board, at: Vec3): 'left' | 'right' {
  const mid = (x: number) => toWorld(b, { x, y: b.length / 2, z: b.thickness / 2 })
  const d = (q: Vec3) => (q.x - at.x) ** 2 + (q.y - at.y) ** 2 + (q.z - at.z) ** 2
  return d(mid(0)) <= d(mid(b.width)) ? 'left' : 'right'
}
/** The board's face ('top' = local +z) that looks along a world direction. */
export function faceLooking(b: Board, dir: Vec3): 'top' | 'bottom' {
  const n = dirOf(b, { x: 0, y: 0, z: 1 })
  return n.x * dir.x + n.y * dir.y + n.z * dir.z >= 0 ? 'top' : 'bottom'
}
/** The board's end ('start' = local y 0) nearer a world point. */
export function endToward(b: Board, at: Vec3): 'start' | 'end' {
  const mid = (y: number) => toWorld(b, { x: b.width / 2, y, z: b.thickness / 2 })
  const d = (q: Vec3) => (q.x - at.x) ** 2 + (q.y - at.y) ** 2 + (q.z - at.z) ** 2
  return d(mid(0)) <= d(mid(b.length)) ? 'start' : 'end'
}
export const centreOf = (b: Board): Vec3 => { const w = worldBox(b); return { x: (w.min.x + w.max.x) / 2, y: (w.min.y + w.max.y) / 2, z: (w.min.z + w.max.z) / 2 } }

/** A dado or rabbet in `host` where `partner` sits in it (measured from where they overlap), with set sizes when given. */
export function seat(type: 'dado' | 'rabbet', host: Board, partner: Board, along: 'width' | 'length', set: Partial<GrooveParams> = {}): Joint {
  const pl = boxInLocal(host, worldBox(partner))
  const lo = along === 'width' ? pl.min.y : pl.min.x
  const hi = along === 'width' ? pl.max.y : pl.max.x
  const depth = Math.min(pl.max.z, host.thickness) - Math.max(pl.min.z, 0)
  const params: GrooveParams = { width: snap64(hi - lo), depth: snap64(depth), offset: snap64(Math.max(0, lo)), face: faceToward(host, partner), along, ...set }
  return { id: newId('j'), type, hostBoardId: host.id, partnerBoardId: partner.id, params }
}

/** A groove in the host's edge (centred in its thickness) that `partner` sits in. */
export function edgeGroove(host: Board, partner: Board, width: number, depth: number): Joint {
  const face = edgeToward(host, centreOf(partner))
  return { id: newId('j'), type: 'dado', hostBoardId: host.id, partnerBoardId: partner.id, params: { width, depth, offset: snap64((host.thickness - width) / 2), face, along: 'length' } }
}

/** A rabbet at one end of `host` on one face (a stub tenon's cheek, say). */
export function endRabbet(host: Board, partner: Board, end: 'start' | 'end', face: 'top' | 'bottom', width: number, depth: number, standalone = false): Joint {
  return { id: newId('j'), type: 'rabbet', hostBoardId: host.id, partnerBoardId: partner.id, params: { width, depth, offset: end === 'start' ? 0 : snap64(host.length - width), face, along: 'width', ...(standalone ? { standalone } : {}) } }
}
/** A rabbet along one edge of `host` on one face (a glass rabbet, a raised panel's tongue). */
export function edgeRabbet(host: Board, partner: Board, edge: 'left' | 'right', face: 'top' | 'bottom', width: number, depth: number, standalone = false): Joint {
  return { id: newId('j'), type: 'rabbet', hostBoardId: host.id, partnerBoardId: partner.id, params: { width, depth, offset: edge === 'left' ? 0 : snap64(host.width - width), face, along: 'length', ...(standalone ? { standalone } : {}) } }
}

export const joint = (type: 'butt' | 'pocketScrew', host: Board, partner: Board, params: Joint['params']): Joint =>
  ({ id: newId('j'), type, hostBoardId: host.id, partnerBoardId: partner.id, params })
