// Turns a snap result into what the 3D view shows: a short label, guide lines, highlighted faces and a readout.
import { worldBox, type Axis, type Box } from './geometry'
import { formatInches } from './units'
import type { SnapResult } from './snap'
import type { Project, Vec3 } from './types'

export type Guide = { axis: Axis; from: Vec3; to: Vec3 }
/** A flat rectangle on a face of another board (zero thickness along `axis`). */
export type FaceHighlight = { boardId: string; axis: Axis; at: number; min: Vec3; max: Vec3 }
export type SnapFeedback = {
  kind: 'corner' | 'edge' | 'face' | 'midpoint' | 'grid' | 'off'
  label: string
  targetIds: string[]
  guides: Guide[]
  highlights: FaceHighlight[]
  /** Where to draw the snap marker. */
  marker: Vec3
  readout: string
}

const AX: Axis[] = ['x', 'y', 'z']
const zero = (): Vec3 => ({ x: 0, y: 0, z: 0 })
const with1 = (v: Vec3, ax: Axis, n: number): Vec3 => ({ ...v, [ax]: n })

export function gridLabel(grid: number): string {
  return grid > 0 && grid < 1 ? `1/${Math.round(1 / grid)}" grid` : `${grid}" grid`
}

/** Plain-words distance moved since the drag began, e.g. `X +4-1/16"  Z -1/2"`. */
export function moveReadout(from: Vec3, to: Vec3): string {
  const parts = AX.flatMap(ax => {
    const d = to[ax] - from[ax]
    if (Math.abs(d) < 1 / 64) return []
    return [`${ax.toUpperCase()} ${d > 0 ? '+' : ''}${formatInches(d, { sixtyFourths: true })}`]
  })
  return parts.length ? parts.join('  ') : 'Not moved'
}

export function snapFeedback(project: Project, id: string, result: SnapResult, opts: { grid: number; start: Vec3 }): SnapFeedback {
  const b = project.boards.find(x => x.id === id)
  const moved = moveReadout(opts.start, result.position)
  if (!b) return { kind: 'off', label: 'Snap off', targetIds: [], guides: [], highlights: [], marker: result.position, readout: moved }
  const moving: Box = worldBox({ ...b, position: result.position })
  const center = (box: Box): Vec3 => ({ x: (box.min.x + box.max.x) / 2, y: (box.min.y + box.max.y) / 2, z: (box.min.z + box.max.z) / 2 })
  if (result.hits.length === 0) {
    return { kind: 'off', label: 'Snap off', targetIds: [], guides: [], highlights: [], marker: center(moving), readout: moved }
  }
  const faces = result.hits.filter(h => h.kind === 'face')
  const centers = result.hits.filter(h => h.kind === 'center')
  const kind: SnapFeedback['kind'] = faces.length >= 3 ? 'corner' : faces.length === 2 ? 'edge' : faces.length === 1 ? 'face' : centers.length ? 'midpoint' : 'grid'
  const label = kind === 'corner' ? 'Corner' : kind === 'edge' ? 'Edge' : kind === 'face' ? 'Face' : kind === 'midpoint' ? 'Midpoint' : gridLabel(opts.grid)
  const aligned = result.hits.filter(h => h.kind !== 'grid')
  const targetIds = [...new Set(aligned.flatMap(h => (h.targetId ? [h.targetId] : [])))]
  const boxOf = (tid: string): Box => worldBox(project.boards.find(x => x.id === tid)!)

  const guides: Guide[] = aligned.map(h => {
    const t = boxOf(h.targetId!)
    const lo = { x: Math.min(t.min.x, moving.min.x), y: Math.min(t.min.y, moving.min.y), z: Math.min(t.min.z, moving.min.z) }
    const hi = { x: Math.max(t.max.x, moving.max.x), y: Math.max(t.max.y, moving.max.y), z: Math.max(t.max.z, moving.max.z) }
    // Run the line along whichever other direction is longest, through the middle of the board being moved.
    const others = AX.filter(a => a !== h.axis)
    const along = others.reduce((best, a) => (hi[a] - lo[a] > hi[best] - lo[best] ? a : best), others[0])
    const mid = center(moving)
    const base = with1(mid, h.axis, h.at)
    return { axis: h.axis, from: with1(base, along, lo[along]), to: with1(base, along, hi[along]) }
  })

  const highlights: FaceHighlight[] = faces.map(h => {
    const t = boxOf(h.targetId!)
    return { boardId: h.targetId!, axis: h.axis, at: h.at, min: with1(t.min, h.axis, h.at), max: with1(t.max, h.axis, h.at) }
  })

  const marker = aligned.length === 0 ? zero() : center(moving)
  for (const h of result.hits) {
    if (kind === 'grid' || h.kind !== 'grid') marker[h.axis] = h.at
  }

  const names = targetIds.map(t => project.boards.find(x => x.id === t)?.name ?? t)
  const readout = names.length ? `${moved}  ·  with ${names.join(', ')}` : moved
  return { kind, label, targetIds, guides, highlights, marker, readout }
}
