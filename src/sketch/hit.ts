// What's under the pointer on the drawing board.
import { pointOf } from './geometry'
import { nearestOn, primOf } from './intersect'
import type { Pt, Sketch } from './types'

export type Hit = { kind: 'point' | 'entity'; id: string; d: number }

/** The nearest point (preferred) or shape within `tol` inches of q. */
export function hitTest(sk: Sketch, q: Pt, tol: number, opts: { points?: boolean; entities?: boolean } = {}): Hit | null {
  let best: Hit | null = null
  if (opts.points !== false) {
    for (const p of sk.points) {
      const d = Math.hypot(p.x - q.x, p.y - q.y)
      if (d <= tol && (!best || d < best.d)) best = { kind: 'point', id: p.id, d }
    }
    if (best) return best
  }
  if (opts.entities === false) return null
  for (const e of sk.entities) {
    let d: number
    if (e.kind === 'text') {
      const a = pointOf(sk, e.at)
      const w = 0.6 * e.height * e.text.length
      const inside = q.x >= a.x - tol && q.x <= a.x + w + tol && q.y >= a.y - tol && q.y <= a.y + e.height + tol
      d = inside ? 0 : Infinity
    } else {
      const p = primOf(sk, e)
      d = p ? nearestOn(p, q).d : Infinity
    }
    if (d <= tol && (!best || d < best.d)) best = { kind: 'entity', id: e.id, d }
  }
  return best
}

/** Points that are corners: shared by exactly two lines (for fillet and chamfer). */
export function cornerPoints(sk: Sketch): string[] {
  const count = new Map<string, number>()
  for (const e of sk.entities) if (e.kind === 'line' && !e.construction) for (const id of [e.a, e.b]) count.set(id, (count.get(id) ?? 0) + 1)
  return [...count].filter(([, n]) => n === 2).map(([id]) => id)
}
