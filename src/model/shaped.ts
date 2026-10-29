// Shaped parts: a board cut to the outline of a drawing. The board's width × length stay its bounding rectangle,
// so the cut list, stock checks, joints and contact all keep working on the rectangle it is cut from.
import { boxInLocal, isAxisAligned, worldBox } from './geometry'
import type { Board, Project } from './types'
import { snap64 } from './units'
import { findWood } from './woods'
import { addBoard, type OpError } from './ops'
import { extremePoints, loopPolygon, outlineFromSketch, pointInPolygon, tessellate, bounds as polyBounds } from '../sketch/geometry'
import type { Outline, Pt, Sketch } from '../sketch/types'

export const SHAPED_NOTE = 'Shaped — cut to pattern (print full size)'

export const sketchOf = (p: Project, id: string): Sketch | undefined => p.sketches?.find(s => s.id === id)

/** Drawing coordinates → the board's own (x across the width, y along the length), starting at 0,0. */
function placer(sk: Sketch, o: Outline): ((q: Pt) => Pt) | null {
  try {
    const ents = o.outer.map(id => sk.entities.find(e => e.id === id))
    if (ents.some(e => !e)) return null
    const b = polyBounds(ents.map(e => extremePoints(sk, e!)))
    if (o.turn === 90) return q => ({ x: b.maxY - q.y, y: q.x - b.minX })
    return q => ({ x: q.x - b.minX, y: q.y - b.minY })
  } catch {
    return null
  }
}

function loopPts(sk: Sketch, loop: string[]): Pt[] {
  const e = loop.length === 1 ? sk.entities.find(x => x.id === loop[0]) : undefined
  return e?.kind === 'circle' ? tessellate(sk, e.id) : loopPolygon(sk, loop)
}

/** The board's shape in its own coordinates, or null for a plain rectangle (or a drawing that has gone missing). */
export function outlinePolygons(p: Project, b: Board): { outer: Pt[]; holes: Pt[][] } | null {
  if (!b.outline) return null
  const sk = sketchOf(p, b.outline.sketchId)
  if (!sk) return null
  const place = placer(sk, b.outline)
  if (!place) return null
  try {
    const outer = loopPts(sk, b.outline.outer).map(place)
    const holes = [...b.outline.holes.map(h => loopPts(sk, h)), ...b.outline.circles.map(c => tessellate(sk, c))].map(poly => poly.map(place))
    return outer.length >= 3 ? { outer, holes } : null
  } catch {
    return null
  }
}

/** Size of the outline once placed on a board. */
function placedSize(sk: Sketch, o: Outline): { width: number; length: number } {
  const ents = o.outer.map(id => sk.entities.find(e => e.id === id)!)
  const b = polyBounds(ents.map(e => extremePoints(sk, e)))
  const w = b.maxX - b.minX, h = b.maxY - b.minY
  return o.turn === 90 ? { width: snap64(h), length: snap64(w) } : { width: snap64(w), length: snap64(h) }
}

/**
 * Cuts a board to a drawing's outline. With no board, a new board is made from `woodId` (lying flat at the origin);
 * with a board, that board takes the shape and keeps its place. The drawing's long direction runs along the grain.
 */
export function shapeBoard(p: Project, boardId: string | null, sketchId: string, woodId?: string): { project: Project; id: string } | OpError {
  const sk = sketchOf(p, sketchId)
  if (!sk) return { error: 'That drawing is missing' }
  const r = outlineFromSketch(sk)
  if ('error' in r) return { error: r.error }
  const b = polyBounds([r.outer])
  const existing = boardId ? p.boards.find(x => x.id === boardId) : undefined
  const turn: 0 | 90 = existing?.outline?.sketchId === sketchId && existing.outline.turn !== undefined
    ? existing.outline.turn
    : existing
      ? 90 // Edit shape draws a board's length across the sheet.
      : b.maxX - b.minX > b.maxY - b.minY ? 90 : 0
  const outline: Outline = { ...r.outline, turn }
  const size = placedSize(sk, outline)
  if (existing) {
    const project = { ...p, boards: p.boards.map(x => (x.id === existing.id ? { ...x, ...size, outline } : x)) }
    return { project, id: existing.id }
  }
  if (!woodId || !findWood(p, woodId)) return { error: 'Choose a wood for the part' }
  return addBoard(p, { woodId, name: sk.name, ...size, outline })
}

/** Back to a plain rectangle (its bounding rectangle). */
export function unshapeBoard(p: Project, boardId: string): Project {
  return { ...p, boards: p.boards.map(b => {
    if (b.id !== boardId || !b.outline) return b
    const { outline: _o, ...rest } = b
    return rest
  }) }
}

export function addSketch(p: Project, sk: Sketch): Project {
  return { ...p, sketches: [...(p.sketches ?? []), sk] }
}

/** Saves an edited drawing; every part cut from it takes the new shape (if it still makes one). */
export function updateSketch(p: Project, sk: Sketch): Project {
  let next: Project = { ...p, sketches: (p.sketches ?? []).map(s => (s.id === sk.id ? sk : s)) }
  for (const b of next.boards) {
    if (b.outline?.sketchId !== sk.id) continue
    const r = shapeBoard(next, b.id, sk.id)
    if (!('error' in r)) next = r.project
  }
  return next
}

/** Deletes a drawing; parts cut from it become rectangles again. */
export function deleteSketch(p: Project, sketchId: string): Project {
  let next: Project = { ...p, sketches: (p.sketches ?? []).filter(s => s.id !== sketchId) }
  for (const b of p.boards) if (b.outline?.sketchId === sketchId) next = unshapeBoard(next, b.id)
  return next
}

/** True when the shaped board actually has wood where it meets the other board. */
export function shapeReaches(p: Project, shaped: Board, other: Board): boolean {
  const poly = outlinePolygons(p, shaped)
  if (!poly || !isAxisAligned(shaped) || !isAxisAligned(other)) return true
  const box = boxInLocal(shaped, worldBox(other))
  const x0 = Math.max(0, box.min.x), x1 = Math.min(shaped.width, box.max.x)
  const y0 = Math.max(0, box.min.y), y1 = Math.min(shaped.length, box.max.y)
  if (x1 < x0 || y1 < y0) return true
  const N = 6
  let inside = 0
  for (let i = 0; i <= N; i++) for (let k = 0; k <= N; k++) {
    const q = { x: x0 + ((x1 - x0) * (i + 0.5)) / (N + 1), y: y0 + ((y1 - y0) * (k + 0.5)) / (N + 1) }
    if (pointInPolygon(q, poly.outer) && !poly.holes.some(h => pointInPolygon(q, h))) inside++
  }
  return inside / ((N + 1) * (N + 1)) >= 0.5
}
