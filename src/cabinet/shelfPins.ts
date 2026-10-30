// Shelf-pin holes: two rows of stopped holes up the inside of a cabinet side.
import { toWorld } from '../model/geometry'
import type { Board, Hole, Project } from '../model/types'
import { snap64 } from '../model/units'
import { addHardware } from './hardware'

export type PinOptions = {
  size: '5mm' | '1/4'
  depth: number
  /** Row distances in from the front and back edges. */
  front: number; back: number
  spacing: number
  /** From above the bottom end and below the top end. */
  from: number; to: number
  face: 'top' | 'bottom'
  /** Shelves resting on pins (4 pins each) — for the hardware list. */
  shelves: number
}
export const MM32 = 32 / 25.4
export const PIN_DEFAULTS: Omit<PinOptions, 'face'> = { size: '5mm', depth: 0.375, front: 1.5, back: 1.5, spacing: MM32, from: 6, to: 6, shelves: 0 }
export const pinDiameter = (s: PinOptions['size']) => (s === '5mm' ? 5 / 25.4 : 0.25)

/** Hole positions on one side (u across, v along), rows measured from the world front and the bottom end. */
export function pinHoles(b: Board, o: PinOptions): Hole[] | { error: string } {
  if (!(o.spacing > 0)) return { error: 'Give the hole spacing' }
  if (o.front + o.back >= b.width) return { error: 'The rows are wider apart than the part' }
  // Which local edge is at the front (lower world y) and which end is at the bottom (lower world z).
  const frontAtZero = toWorld(b, { x: 0, y: b.length / 2, z: 0 }).y <= toWorld(b, { x: b.width, y: b.length / 2, z: 0 }).y
  const bottomAtZero = toWorld(b, { x: b.width / 2, y: 0, z: 0 }).z <= toWorld(b, { x: b.width / 2, y: b.length, z: 0 }).z
  const us = [frontAtZero ? o.front : b.width - o.front, frontAtZero ? b.width - o.back : o.back]
  const d = pinDiameter(o.size)
  const out: Hole[] = []
  for (let h = o.from; h <= b.length - o.to + 1e-9; h += o.spacing) {
    const v = snap64(bottomAtZero ? h : b.length - h)
    for (const u of us) out.push({ diameter: d, u: snap64(u), v, depth: o.depth, face: o.face })
  }
  if (!out.length) return { error: 'There is no room for pins between those heights' }
  return out
}

/** Lays out shelf pins on a side (replacing an earlier layout of the same size), and lists the pins. */
export function addShelfPins(p: Project, boardId: string, o: PinOptions): Project | { error: string } {
  const b = p.boards.find(x => x.id === boardId)
  if (!b) return { error: 'Select a cabinet side' }
  const holes = pinHoles(b, o)
  if ('error' in holes) return holes
  const d = pinDiameter(o.size)
  const kept = b.holes.filter(h => !(h.depth !== undefined && Math.abs(h.diameter - d) < 1e-9))
  let next: Project = { ...p, boards: p.boards.map(x => (x.id === boardId ? { ...x, holes: [...kept, ...holes] } : x)) }
  const item = o.size === '5mm' ? 'pin-5mm' : 'pin-14'
  next = { ...next, hardware: (next.hardware ?? []).filter(h => !(h.boardId === boardId && h.itemId === item)) }
  if (!next.hardware!.length) delete next.hardware
  if (o.shelves > 0) next = addHardware(next, { itemId: item, qty: 4 * o.shelves, boardId })
  return next
}

/** The face of `b` that looks toward `other` (for mirroring a layout onto the facing side). */
export function faceToward(b: Board, other: Board): 'top' | 'bottom' {
  const mid = (x: Board) => toWorld(x, { x: x.width / 2, y: x.length / 2, z: x.thickness / 2 })
  const top = toWorld(b, { x: b.width / 2, y: b.length / 2, z: b.thickness }), bot = toWorld(b, { x: b.width / 2, y: b.length / 2, z: 0 })
  const o = mid(other)
  const d = (q: { x: number; y: number; z: number }) => (q.x - o.x) ** 2 + (q.y - o.y) ** 2 + (q.z - o.z) ** 2
  return d(top) <= d(bot) ? 'top' : 'bottom'
}
