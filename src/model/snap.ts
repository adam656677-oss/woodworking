// Snapping a board being moved: onto nearby faces of other boards, otherwise onto a grid.
import { AXES, worldBox } from './geometry'
import type { Project, Vec3 } from './types'

export type SnapResult = { position: Vec3; snaps: ('face' | 'grid')[] }

/**
 * Per axis: if a face of the moving board comes within `tolerance` of a coplanar face of another
 * board, it snaps flush (corner and edge snaps fall out of snapping two or three axes). Otherwise
 * the board's lower corner rounds to `grid`.
 */
export function snapPosition(project: Project, id: string, proposed: Vec3, opts: { tolerance: number; grid: number }): SnapResult {
  const b = project.boards.find(x => x.id === id)
  if (!b) return { position: proposed, snaps: [] }
  const moving = worldBox({ ...b, position: proposed })
  const others = project.boards.filter(x => x.id !== id).map(worldBox)
  const position = { ...proposed }
  const snaps: ('face' | 'grid')[] = []
  for (const ax of AXES) {
    let best: number | null = null
    for (const o of others) {
      for (const target of [o.min[ax], o.max[ax]]) {
        for (const face of [moving.min[ax], moving.max[ax]]) {
          const d = target - face
          if (Math.abs(d) <= opts.tolerance && (best === null || Math.abs(d) < Math.abs(best))) best = d
        }
      }
    }
    if (best !== null) {
      position[ax] = proposed[ax] + best
      snaps.push('face')
    } else {
      const d = Math.round(moving.min[ax] / opts.grid) * opts.grid - moving.min[ax]
      position[ax] = proposed[ax] + d
      snaps.push('grid')
    }
    position[ax] = Math.round(position[ax] * 1e9) / 1e9
  }
  return { position, snaps }
}
