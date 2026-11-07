// Fusion-style modeling on top of the part model: sketch a profile on a work plane, pull it into a solid, push or
// pull a part's face, or pull a profile through a part to cut it. Every solid is a woodworking part straight away:
// a rectangular block becomes a board whose thinnest side is its thickness, any other profile becomes a shaped part.
import polygonClipping from 'polygon-clipping'
import { isAxisAligned, localAxes, rotateVec, worldBox, type Axis, type Box } from '../model/geometry'
import { newId } from '../model/ids'
import { addBoard, type OpError } from '../model/ops'
import { addSketch, outlinePolygons, shapeBoard } from '../model/shaped'
import type { Board, Project, Vec3 } from '../model/types'
import { snap64 } from '../model/units'
import { findWood } from '../model/woods'
import type { Pt, Sketch, SketchEntity, SketchPoint } from '../sketch/types'

/**
 * A flat surface to sketch on: `origin` plus `u` (sketch x) and `v` (sketch y), with `n` = u × v pointing out of it.
 * All three are world axes (or their negatives): the floor, a wall or the face of a square-set part.
 */
export type WorkPlane = { origin: Vec3; u: Vec3; v: Vec3; n: Vec3; label: string }

export type Profile =
  | { kind: 'rect'; a: Pt; b: Pt }
  | { kind: 'circle'; c: Pt; r: number }
  | { kind: 'poly'; pts: Pt[] }

const V = (x: number, y: number, z: number): Vec3 => ({ x, y, z })
const add = (a: Vec3, b: Vec3): Vec3 => V(a.x + b.x, a.y + b.y, a.z + b.z)
const scale = (a: Vec3, k: number): Vec3 => V(a.x * k, a.y * k, a.z * k)
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z
const cross = (a: Vec3, b: Vec3): Vec3 => V(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x)
const clean = (n: number) => Math.round(n * 1e9) / 1e9 + 0
const cleanV = (a: Vec3): Vec3 => V(clean(a.x), clean(a.y), clean(a.z))
const AXES: Axis[] = ['x', 'y', 'z']
const unit = (axis: Axis, sign = 1): Vec3 => V(axis === 'x' ? sign : 0, axis === 'y' ? sign : 0, axis === 'z' ? sign : 0)
const axisOf = (v: Vec3): Axis => AXES.reduce((best, a) => (Math.abs(v[a]) > Math.abs(v[best]) ? a : best), 'x' as Axis)

/** The three starting planes, through the origin: floor (looking down), front wall (looking from the front), side wall. */
export const FLOOR: WorkPlane = { origin: V(0, 0, 0), u: V(1, 0, 0), v: V(0, 1, 0), n: V(0, 0, 1), label: 'Floor' }
export const FRONT: WorkPlane = { origin: V(0, 0, 0), u: V(1, 0, 0), v: V(0, 0, 1), n: V(0, -1, 0), label: 'Front' }
export const SIDE: WorkPlane = { origin: V(0, 0, 0), u: V(0, 1, 0), v: V(0, 0, 1), n: V(1, 0, 0), label: 'Side' }

/** Sketch coordinates → world. */
export const planeToWorld = (pl: WorkPlane, q: Pt, h = 0): Vec3 => cleanV(add(add(add(pl.origin, scale(pl.u, q.x)), scale(pl.v, q.y)), scale(pl.n, h)))
/** World → sketch coordinates (and height above the plane). */
export function worldToPlane(pl: WorkPlane, w: Vec3): { q: Pt; h: number } {
  const d = V(w.x - pl.origin.x, w.y - pl.origin.y, w.z - pl.origin.z)
  return { q: { x: clean(dot(d, pl.u)), y: clean(dot(d, pl.v)) }, h: clean(dot(d, pl.n)) }
}

/** The plane on one face of a square-set part: `axis`/`side` say which face ('max' = the + side). */
export function facePlane(b: Board, axis: Axis, side: 'min' | 'max'): WorkPlane {
  const box = worldBox(b)
  const n = unit(axis, side === 'max' ? 1 : -1)
  // u and v follow the other world axes, chosen so u × v = n and "up" stays up on walls.
  const others = AXES.filter(a => a !== axis)
  let u = unit(others[0]), v = unit(others[1])
  if (axis === 'y') { u = unit('x'); v = unit('z') }
  if (dot(cross(u, v), n) < 0) u = scale(u, -1)
  const origin = V(axis === 'x' ? box[side].x : 0, axis === 'y' ? box[side].y : 0, axis === 'z' ? box[side].z : 0)
  return { origin, u: cleanV(u), v, n, label: `${b.name} face` }
}

/** Which face of a part a world normal points out of (for picking a face to sketch on or push/pull). */
export function faceFromNormal(n: Vec3): { axis: Axis; side: 'min' | 'max' } {
  const axis = axisOf(n)
  return { axis, side: n[axis] >= 0 ? 'max' : 'min' }
}

const TAU = Math.PI * 2
/** The profile as a polygon (circles as 48 straight pieces), counter-clockwise. */
export function profilePolygon(p: Profile, segs = 48): Pt[] {
  if (p.kind === 'rect') {
    const x0 = Math.min(p.a.x, p.b.x), x1 = Math.max(p.a.x, p.b.x), y0 = Math.min(p.a.y, p.b.y), y1 = Math.max(p.a.y, p.b.y)
    return [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }]
  }
  if (p.kind === 'circle') return Array.from({ length: segs }, (_, i) => ({ x: p.c.x + p.r * Math.cos((TAU * i) / segs), y: p.c.y + p.r * Math.sin((TAU * i) / segs) }))
  const area = p.pts.reduce((s, a, i) => { const b = p.pts[(i + 1) % p.pts.length]; return s + a.x * b.y - b.x * a.y }, 0)
  return area < 0 ? [...p.pts].reverse() : p.pts
}

/** Why a profile can't be pulled, or null. */
export function profileProblem(p: Profile): string | null {
  if (p.kind === 'rect') return Math.abs(p.a.x - p.b.x) < 1 / 64 || Math.abs(p.a.y - p.b.y) < 1 / 64 ? 'Draw a rectangle with some width and height' : null
  if (p.kind === 'circle') return p.r < 1 / 64 ? 'Give the circle a size' : null
  if (p.pts.length < 3) return 'An outline needs at least three corners'
  // Edges must not cross each other.
  const n = p.pts.length
  const crosses = (a: Pt, b: Pt, c: Pt, d: Pt) => {
    const o = (p1: Pt, p2: Pt, p3: Pt) => (p2.x - p1.x) * (p3.y - p1.y) - (p2.y - p1.y) * (p3.x - p1.x)
    return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0
  }
  for (let i = 0; i < n; i++) for (let k = i + 2; k < n; k++) {
    if (i === 0 && k === n - 1) continue
    if (crosses(p.pts[i], p.pts[(i + 1) % n], p.pts[k], p.pts[(k + 1) % n])) return 'The outline crosses itself; move a corner so the edges do not cross'
  }
  return null
}

/** Every axis-aligned rotation (Euler XYZ, degrees), for matching a part's axes to world directions. */
const ROTATIONS: Vec3[] = (() => {
  const out: Vec3[] = [], seen = new Set<string>()
  for (const x of [0, 90, 180, 270]) for (const y of [0, 90, 180, 270]) for (const z of [0, 90, 180, 270]) {
    const r = V(x, y, z)
    const key = [rotateVec(V(1, 0, 0), r), rotateVec(V(0, 1, 0), r)].map(v => `${v.x},${v.y},${v.z}`).join('|')
    if (!seen.has(key)) { seen.add(key); out.push(r) }
  }
  return out
})()
const same = (a: Vec3, b: Vec3) => Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6 && Math.abs(a.z - b.z) < 1e-6
/** The rotation that turns a part's width (x) and length (y) directions into these world directions. */
function rotationFor(widthDir: Vec3, lengthDir: Vec3): Vec3 {
  const r = ROTATIONS.find(r => same(rotateVec(V(1, 0, 0), r), widthDir) && same(rotateVec(V(0, 1, 0), r), lengthDir))
  if (!r) throw new Error('No rotation for those directions')
  // Keep the angles the rest of the app uses (-90..180).
  return V(r.x > 180 ? r.x - 360 : r.x, r.y > 180 ? r.y - 360 : r.y, r.z > 180 ? r.z - 360 : r.z)
}
/** Position for a part so that its local point `local` lands on `world`. */
function placeAt(rotation: Vec3, local: Vec3, world: Vec3): Vec3 {
  const r = rotateVec(local, rotation)
  return cleanV(V(world.x - r.x, world.y - r.y, world.z - r.z))
}

/**
 * A rectangular block as a board: thinnest side = thickness, longest = length (along the grain), the middle = width,
 * placed so it fills exactly `box`.
 */
export function boardForBox(box: Box): Pick<Board, 'thickness' | 'width' | 'length' | 'rotation' | 'position'> {
  const size = { x: box.max.x - box.min.x, y: box.max.y - box.min.y, z: box.max.z - box.min.z }
  const [tA, wA, lA] = [...AXES].sort((a, b) => size[a] - size[b] || AXES.indexOf(a) - AXES.indexOf(b))
  const rotation = rotationFor(unit(wA), unit(lA))
  // The board's own (0,0,0) corner is where all three local axes start; with positive axis directions that is box.min.
  void tA
  const t = snap64(size[tA]), w = snap64(size[wA]), l = snap64(size[lA])
  const thicknessDir = rotateVec(V(0, 0, 1), rotation)
  // If the thickness points the "wrong" way the corner moves to the other side of that axis.
  const corner = V(box.min.x, box.min.y, box.min.z)
  const ta = axisOf(thicknessDir)
  if (thicknessDir[ta] < 0) corner[ta] = box.max[ta]
  return { thickness: t, width: w, length: l, rotation, position: placeAt(rotation, V(0, 0, 0), corner) }
}

const dist2 = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y)

/** A sketch (stored with the project) whose one closed loop is this polygon or circle, in plane coordinates. */
function profileSketch(name: string, p: Profile, extraLoops: Pt[][] = []): Sketch {
  const sk: Sketch = { id: newId('s'), name, mode: 'precise', points: [], entities: [], constraints: [] }
  const addLoop = (poly: Pt[]) => {
    const ids = poly.map(q => { const id = newId('p'); sk.points.push({ id, x: snap64(q.x), y: snap64(q.y) } as SketchPoint); return id })
    ids.forEach((a, i) => sk.entities.push({ id: newId('s'), kind: 'line', a, b: ids[(i + 1) % ids.length] } as SketchEntity))
  }
  if (p.kind === 'circle') {
    const c = newId('p')
    sk.points.push({ id: c, x: snap64(p.c.x), y: snap64(p.c.y) })
    sk.entities.push({ id: newId('s'), kind: 'circle', center: c, r: snap64(p.r) })
  } else addLoop(profilePolygon(p))
  for (const loop of extraLoops) addLoop(loop)
  return sk
}

export type PullResult = { project: Project; id: string; note?: string }

/**
 * Pulls a profile on a plane into a solid `distance` inches along the plane's normal (negative = the other way)
 * and adds it to the design as a part.
 */
export function pullProfile(p: Project, pl: WorkPlane, profile: Profile, distance: number, woodId: string, name: string): PullResult | OpError {
  const problem = profileProblem(profile)
  if (problem) return { error: problem }
  if (Math.abs(distance) < 1 / 64) return { error: 'Pull it out some distance (type it, like 3/4)' }
  if (!findWood(p, woodId)) return { error: 'Choose a wood for the part' }
  const d = snap64(distance)
  if (profile.kind === 'rect') {
    const corners = [profile.a, profile.b].flatMap(q => [planeToWorld(pl, q, 0), planeToWorld(pl, q, d)])
    const box: Box = {
      min: V(Math.min(...corners.map(c => c.x)), Math.min(...corners.map(c => c.y)), Math.min(...corners.map(c => c.z))),
      max: V(Math.max(...corners.map(c => c.x)), Math.max(...corners.map(c => c.y)), Math.max(...corners.map(c => c.z)))
    }
    const r = addBoard(p, { woodId, name, ...boardForBox(box) })
    return r
  }
  // Any other profile is the face of a shaped part, and the pull is its thickness.
  const sk = profileSketch(name, profile)
  let next = addSketch(p, sk)
  const shaped = shapeBoard(next, null, sk.id, woodId)
  if ('error' in shaped) return shaped
  next = shaped.project
  const b = next.boards.find(x => x.id === shaped.id)!
  const poly = profilePolygon(profile)
  const minX = Math.min(...poly.map(q => q.x)), minY = Math.min(...poly.map(q => q.y))
  const maxY = Math.max(...poly.map(q => q.y))
  const turn = b.outline!.turn ?? 0
  // turn 0: the part's x = sketch x, y = sketch y. turn 90: x = (maxY − sketch y), y = sketch x.
  const widthDir = turn === 90 ? scale(pl.v, -1) : pl.u
  const lengthDir = turn === 90 ? pl.u : pl.v
  // Thickness runs along width × length = u × v = n for both turns; a pull the other way starts below the plane.
  const rotation = rotationFor(widthDir, lengthDir)
  const origin = planeToWorld(pl, turn === 90 ? { x: minX, y: maxY } : { x: minX, y: minY }, Math.min(0, d))
  const position = placeAt(rotation, V(0, 0, 0), origin)
  const thickness = Math.abs(d)
  const span = Math.max(b.width, b.length)
  next = { ...next, boards: next.boards.map(x => (x.id === b.id ? { ...x, thickness, rotation, position } : x)) }
  const note = thickness > span ? `${name} is thicker than it is wide; check how it will be cut, or pull a rectangle for a block.` : undefined
  return { project: next, id: b.id, note }
}

/** A part's face polygon (outline or rectangle, minus its holes), in its own coordinates. */
function partFace(p: Project, b: Board): Pt[][][] {
  const shape = outlinePolygons(p, b)
  const outer = shape?.outer ?? [{ x: 0, y: 0 }, { x: b.width, y: 0 }, { x: b.width, y: b.length }, { x: 0, y: b.length }]
  const ring = (pts: Pt[]) => [...pts.map(q => [q.x, q.y] as [number, number]), [pts[0].x, pts[0].y] as [number, number]]
  return [[ring(outer), ...(shape?.holes ?? []).map(ring)]] as unknown as Pt[][][]
}

/**
 * Pulls a profile drawn on one of a part's broad faces through the part: the part loses that shape (a hole, a
 * notch or a new edge). Small circles inside the face become drilled holes.
 */
export function cutThrough(p: Project, boardId: string, pl: WorkPlane, profile: Profile, depth: number): Project | OpError {
  const b = p.boards.find(x => x.id === boardId)
  if (!b) return { error: 'That part is gone' }
  if (!isAxisAligned(b)) return { error: 'Cutting works on square-set parts only' }
  const problem = profileProblem(profile)
  if (problem) return { error: problem }
  const ax = localAxes(b)
  if (axisOf(pl.n) !== ax.thickness.axis) return { error: `Cut through ${b.name}'s face (its broad side); a cut from an edge is a joint — use the Joint designer` }
  if (Math.abs(depth) + 1e-6 < b.thickness) return { error: `Pull the cut all the way through ${b.name} (${b.thickness}" thick). A pocket or groove is a joint — use the Joint designer.` }
  // Plane coordinates → the part's own coordinates.
  const inv = (q: Pt): Pt => {
    const w = planeToWorld(pl, q)
    const r = rotateVec(V(w.x - b.position.x, w.y - b.position.y, w.z - b.position.z), V(0, 0, 0))
    // Undo the part's rotation: find local (x, y) such that rotate(local) + position = world.
    const wx = rotateVec(V(1, 0, 0), b.rotation), wy = rotateVec(V(0, 1, 0), b.rotation)
    return { x: clean(dot(r, wx)), y: clean(dot(r, wy)) }
  }
  const cutPoly = profilePolygon(profile).map(inv)
  // A small round hole fully inside the face is drilled.
  if (profile.kind === 'circle' && profile.r * 2 <= 1.5) {
    const c = inv(profile.c)
    const inside = c.x - profile.r > 0 && c.x + profile.r < b.width && c.y - profile.r > 0 && c.y + profile.r < b.length
    if (inside && !b.outline) return { ...p, boards: p.boards.map(x => (x.id === b.id ? { ...x, holes: [...x.holes, { diameter: snap64(profile.r * 2), u: snap64(c.x), v: snap64(c.y) }] } : x)) }
  }
  const ring = [...cutPoly.map(q => [q.x, q.y] as [number, number]), [cutPoly[0].x, cutPoly[0].y] as [number, number]]
  const before = partFace(p, b) as unknown as polygonClipping.MultiPolygon
  const after = polygonClipping.difference(before, [ring])
  if (after.length === 0) return { error: `That would cut away all of ${b.name}` }
  if (after.length > 1) return { error: `That cut would split ${b.name} into ${after.length} pieces; make them separate parts instead` }
  const area = (r: [number, number][]) => Math.abs(r.reduce((s, a, i) => { const c = r[(i + 1) % r.length]; return s + a[0] * c[1] - c[0] * a[1] }, 0)) / 2
  const beforeArea = before[0].reduce((s, r, i) => s + (i ? -1 : 1) * area(r as [number, number][]), 0)
  const afterArea = after[0].reduce((s, r, i) => s + (i ? -1 : 1) * area(r as [number, number][]), 0)
  if (Math.abs(beforeArea - afterArea) < 1e-6) return { error: `The shape doesn't touch ${b.name}` }
  const toPts = (r: [number, number][]) => r.slice(0, -1).map(([x, y]) => ({ x, y }))
  const [outer, ...inner] = after[0].map(r => toPts(r as [number, number][]))
  // Drop collinear points left by the clipper so the outline stays tidy.
  const tidy = (pts: Pt[]) => pts.filter((q, i) => { const a = pts[(i - 1 + pts.length) % pts.length], c = pts[(i + 1) % pts.length]; return Math.abs((q.x - a.x) * (c.y - a.y) - (q.y - a.y) * (c.x - a.x)) > 1e-9 && dist2(q, a) > 1e-9 })
  const sk = profileSketch(b.name, { kind: 'poly', pts: tidy(outer) }, inner.map(tidy))
  let next = addSketch(p, sk)
  // Keep the part exactly where it is: the outline is drawn in its own coordinates (turn 0) starting where it starts.
  const minX = Math.min(...outer.map(q => q.x)), minY = Math.min(...outer.map(q => q.y))
  const shaped = shapeBoard(next, null, sk.id, b.woodId)
  if ('error' in shaped) return shaped
  const outline = { ...shaped.project.boards.find(x => x.id === shaped.id)!.outline!, turn: 0 as const }
  const xs = outer.map(q => q.x), ys = outer.map(q => q.y)
  const width = snap64(Math.max(...xs) - minX), length = snap64(Math.max(...ys) - minY)
  // The part's origin moves by however much the outline's corner moved.
  const position = cleanV(add(b.position, add(scale(rotateVec(V(1, 0, 0), b.rotation), minX), scale(rotateVec(V(0, 1, 0), b.rotation), minY))))
  // Drilled holes are measured from the part's corner, so they move with it.
  const holes = b.holes.map(h => ({ ...h, u: snap64(h.u - minX), v: snap64(h.v - minY) }))
  next = { ...shaped.project, boards: p.boards.map(x => (x.id === b.id ? { ...x, outline, width, length, position, holes } : x)) }
  return next
}

/**
 * Push/Pull one face of a square-set part: `delta` inches outward (negative pushes in). A shaped part can only
 * change thickness (its broad faces).
 */
export function pushPullFace(p: Project, boardId: string, axis: Axis, side: 'min' | 'max', delta: number): Project | OpError {
  const b = p.boards.find(x => x.id === boardId)
  if (!b) return { error: 'That part is gone' }
  if (!isAxisAligned(b)) return { error: 'Push/Pull works on square-set parts only' }
  const d = snap64(delta)
  if (d === 0) return p
  const ax = localAxes(b)
  const dim = (['thickness', 'width', 'length'] as const).find(k => ax[k].axis === axis)!
  if ((b.outline || b.turning) && dim !== 'thickness') return { error: `${b.name} is shaped, so only its broad faces push and pull` }
  const size = b[dim] + d
  if (size < 1 / 16) return { error: `That would make ${b.name} too thin` }
  // The part grows away from its origin along a + axis; pulling the face on the origin side moves the origin.
  const originSide: 'min' | 'max' = ax[dim].sign > 0 ? 'min' : 'max'
  const move = side === originSide ? (ax[dim].sign > 0 ? -d : d) : 0
  const position = { ...b.position, [axis]: clean(b.position[axis] + move) }
  const formulas = b.formulas ? Object.fromEntries(Object.entries(b.formulas).filter(([k]) => k !== dim && k !== axis)) : undefined
  return { ...p, boards: p.boards.map(x => (x.id === b.id ? { ...x, [dim]: snap64(size), position, ...(formulas ? { formulas } : {}) } : x)) }
}

/** True when the part is a block (no side thinner than 4") worth splitting into panels. */
export const isBlock = (b: Board) => isAxisAligned(b) && !b.outline && !b.turning && Math.min(b.thickness, b.width, b.length) >= 4

/** A world-axis plane at height `at` (for "the floor" raised to a shelf height, etc.). */
export function offsetPlane(pl: WorkPlane, at: number): WorkPlane {
  return { ...pl, origin: cleanV(add(pl.origin, scale(pl.n, at))) }
}
