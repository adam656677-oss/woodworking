// Snapping a board being moved: onto nearby faces of other boards, then centre lines, otherwise onto a grid.
import { AXES, worldBox, type Axis } from './geometry'
import type { Project, Vec3 } from './types'

export type SnapKind = 'face' | 'center' | 'grid'
export type Side = 'min' | 'max' | 'center'

/** What one axis snapped to. `at` is the world coordinate of the matching plane (or the grid line). */
export type AxisHit = { axis: Axis; kind: SnapKind; at: number; targetId?: string; movingSide?: Side; targetSide?: Side }
export type SnapResult = { position: Vec3; snaps: SnapKind[]; hits: AxisHit[] }
export type SnapOptions = { tolerance: number; grid: number; /** False (for example while Alt is held) leaves the position exactly as proposed. */ enabled?: boolean }

const round9 = (n: number) => Math.round(n * 1e9) / 1e9 + 0

/**
 * Per axis: if a face of the moving board comes within `tolerance` of a coplanar face of another
 * board, it snaps flush (corner and edge snaps fall out of snapping two or three axes). With no face
 * close, a centre line lined up with another board's centre line snaps. Otherwise the board's lower
 * corner rounds to `grid`.
 */
export function snapPosition(project: Project, id: string, proposed: Vec3, opts: SnapOptions): SnapResult {
  const b = project.boards.find(x => x.id === id)
  if (!b || opts.enabled === false) return { position: proposed, snaps: [], hits: [] }
  const moving = worldBox({ ...b, position: proposed })
  const others = project.boards.filter(x => x.id !== id).map(o => ({ id: o.id, box: worldBox(o) }))
  const position = { ...proposed }
  const snaps: SnapKind[] = []
  const hits: AxisHit[] = []
  for (const ax of AXES) {
    let face: { d: number; plane: number; targetId: string; movingSide: Side; targetSide: Side } | null = null
    let center: { d: number; targetId: string } | null = null
    for (const o of others) {
      for (const targetSide of ['min', 'max'] as const) {
        for (const movingSide of ['min', 'max'] as const) {
          const d = o.box[targetSide][ax] - moving[movingSide][ax]
          if (Math.abs(d) <= opts.tolerance && (face === null || Math.abs(d) < Math.abs(face.d) - 1e-9)) face = { d, plane: o.box[targetSide][ax], targetId: o.id, movingSide, targetSide }
        }
      }
      const d = (o.box.min[ax] + o.box.max[ax]) / 2 - (moving.min[ax] + moving.max[ax]) / 2
      if (Math.abs(d) <= opts.tolerance && (center === null || Math.abs(d) < Math.abs(center.d))) center = { d, targetId: o.id }
    }
    if (face) {
      position[ax] = proposed[ax] + face.d
      snaps.push('face')
      hits.push({ axis: ax, kind: 'face', at: round9(face.plane), targetId: face.targetId, movingSide: face.movingSide, targetSide: face.targetSide })
    } else if (center) {
      position[ax] = proposed[ax] + center.d
      snaps.push('center')
      hits.push({ axis: ax, kind: 'center', at: round9((moving.min[ax] + moving.max[ax]) / 2 + center.d), targetId: center.targetId, movingSide: 'center', targetSide: 'center' })
    } else {
      const d = Math.round(moving.min[ax] / opts.grid) * opts.grid - moving.min[ax]
      position[ax] = proposed[ax] + d
      snaps.push('grid')
      hits.push({ axis: ax, kind: 'grid', at: round9(moving.min[ax] + d), movingSide: 'min' })
    }
    position[ax] = round9(position[ax])
  }
  return { position, snaps, hits }
}
