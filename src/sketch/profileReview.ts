import { bounds, extremePoints, outlineFromSketch } from './geometry'
import type { Sketch } from './types'

export type ProfileReviewResult = { ok: true; across: number; up: number; cutouts: number } | { ok: false; problem: string }

/** Geometric readiness only: not a structural or manufacturing certification. */
export function reviewProfile(sketch: Sketch): ProfileReviewResult {
  if (sketch.points.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) return { ok: false, problem: 'The sketch contains an invalid coordinate.' }
  if (sketch.entities.some(e => e.kind === 'circle' && (!Number.isFinite(e.r) || e.r <= 0))) return { ok: false, problem: 'Circle radii must be finite and positive.' }
  try {
    const result = outlineFromSketch(sketch)
    if ('error' in result) return { ok: false, problem: result.error }
    const outerIds = new Set(result.outline.outer)
    const box = bounds(sketch.entities.filter(e => outerIds.has(e.id)).map(e => extremePoints(sketch, e)))
    const across = box.maxX - box.minX
    const up = box.maxY - box.minY
    if (![across, up].every(n => Number.isFinite(n) && n > 0)) return { ok: false, problem: 'The outline must have a positive width and height.' }
    return { ok: true, across, up, cutouts: result.outline.holes.length + result.outline.circles.length }
  } catch {
    return { ok: false, problem: 'The sketch has missing or invalid geometry. Repair it before making a part.' }
  }
}
