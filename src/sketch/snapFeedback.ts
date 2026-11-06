// What the drawing sheet tells you while you draw: what the pointer snapped to, alignment hints and live sizes.
import { formatInches } from '../model/units'
import { gridLabel } from '../model/snapFeedback'
import type { Snap } from './snap'
import type { Tool } from './drawStore'
import type { Pt } from './types'

const NAMES: Record<Exclude<Snap['kind'], 'grid' | 'none' | 'angle'>, string> = {
  endpoint: 'Endpoint', midpoint: 'Midpoint', center: 'Center', quadrant: 'Quadrant', intersection: 'Crossing', tangent: 'Tangent',
  perpendicular: 'Perpendicular', nearest: 'On the shape'
}

/** A short plain label for a snap, or null when there is nothing to say. `off` means snapping is switched off. */
export function sketchSnapLabel(snap: Snap, grid: number, off = false): string | null {
  if (off) return 'Snap off'
  if (snap.kind === 'none') return null
  return snap.kind === 'grid' ? gridLabel(grid) : snap.kind === 'angle' ? `${snap.angle}°` : NAMES[snap.kind]
}

export type AlignHint = { kind: 'level' | 'upright'; label: string; guide: { from: Pt; to: Pt } }

/** A level or upright run from `from` to `pt`, with a guide line through both (drawing inches). */
export function alignHint(from: Pt | undefined, pt: Pt, tol = 0.005): AlignHint | null {
  if (!from) return null
  const dx = pt.x - from.x, dy = pt.y - from.y
  if (Math.hypot(dx, dy) < 0.01) return null
  const reach = 1e4
  if (Math.abs(dy) <= tol) return { kind: 'level', label: 'Level', guide: { from: { x: Math.min(from.x, pt.x) - reach, y: from.y }, to: { x: Math.max(from.x, pt.x) + reach, y: from.y } } }
  if (Math.abs(dx) <= tol) return { kind: 'upright', label: 'Upright', guide: { from: { x: from.x, y: Math.min(from.y, pt.y) - reach }, to: { x: from.x, y: Math.max(from.y, pt.y) + reach } } }
  return null
}

/** The size being drawn, in tape-measure inches (and degrees for a line), or null for tools without a simple size. */
export function drawReadout(tool: Tool, from: Pt, pt: Pt): string | null {
  const dx = pt.x - from.x, dy = pt.y - from.y
  if (tool === 'line' || tool === 'construction') {
    const deg = Math.round((Math.atan2(dy, dx) * 1800) / Math.PI) / 10 + 0
    return `${formatInches(Math.hypot(dx, dy), { sixtyFourths: true })} at ${deg}°`
  }
  if (tool === 'rect') return `${formatInches(Math.abs(dx), { sixtyFourths: true })} wide × ${formatInches(Math.abs(dy), { sixtyFourths: true })} high`
  if (tool === 'circle') return `Radius ${formatInches(Math.hypot(dx, dy), { sixtyFourths: true })}`
  return null
}
