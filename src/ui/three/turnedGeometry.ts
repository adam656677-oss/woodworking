import * as THREE from 'three'
import { ADDITION, Brush, Evaluator } from 'three-bvh-csg'
import { simplify } from '../../sketch/freehand'

export type TurnedLeg = { blank: number; length: number; top: number; bottom: number; radii: { x: number; r: number }[]; fromStart: boolean }

const evaluator = new Evaluator()
evaluator.useGroups = false

const box = (blank: number, y0: number, y1: number) => {
  const g = new THREE.BoxGeometry(blank, y1 - y0, blank)
  g.translate(blank / 2, (y0 + y1) / 2, blank / 2)
  return g
}

/**
 * A square-to-round leg in board coordinates (x across, y along, z through): square pommel and foot,
 * the profile spun round between them about the blank's centre line.
 */
export function turnedLeg(o: TurnedLeg): THREE.BufferGeometry {
  const B = o.blank / 2
  const yOf = (x: number) => (o.fromStart ? x : o.length - x)
  // The profile is read every 1/32"; keep only the points needed to stay within 1/256" of it.
  const keep = simplify(o.radii.map(q => ({ x: q.x, y: q.r })), 1 / 256)
  const prof = keep.map(i => o.radii[i]).map(q => ({ y: yOf(q.x), r: q.r })).sort((u, v) => u.y - v.y)
  // Close the solid at both ends of the round part, overlapping the square parts a hair so they join.
  const e0 = prof[0].y > 1e-6 ? 0.002 : 0
  const e1 = prof[prof.length - 1].y < o.length - 1e-6 ? 0.002 : 0
  const pts = [new THREE.Vector2(0, prof[0].y - e0), new THREE.Vector2(prof[0].r, prof[0].y - e0), ...prof.map(q => new THREE.Vector2(q.r, q.y)),
    new THREE.Vector2(prof[prof.length - 1].r, prof[prof.length - 1].y + e1), new THREE.Vector2(0, prof[prof.length - 1].y + e1)]
  const lathe = new THREE.LatheGeometry(pts, 48)
  lathe.translate(B, 0, B)
  let solid = new Brush(lathe.toNonIndexed())
  solid.updateMatrixWorld()
  const ends: [number, number][] = []
  const lo = prof[0].y, hi = prof[prof.length - 1].y
  if (lo > 1e-6) ends.push([0, lo])
  if (hi < o.length - 1e-6) ends.push([hi, o.length])
  for (const [y0, y1] of ends) {
    const g = box(o.blank, y0, y1)
    const b = new Brush(g.toNonIndexed())
    b.updateMatrixWorld()
    solid = evaluator.evaluate(solid, b, ADDITION) as Brush
  }
  return solid.geometry
}

/** Signed volume of a closed triangle mesh (cubic inches). */
export function meshVolume(g: THREE.BufferGeometry): number {
  const pos = g.getAttribute('position')
  const idx = g.getIndex()
  const n = idx ? idx.count : pos.count
  const v = (i: number) => new THREE.Vector3().fromBufferAttribute(pos, idx ? idx.getX(i) : i)
  let vol = 0
  for (let i = 0; i < n; i += 3) vol += v(i).dot(new THREE.Vector3().crossVectors(v(i + 1), v(i + 2))) / 6
  return vol
}
