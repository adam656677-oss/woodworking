// Exploded view: how far each part moves out (display only — the design doesn't change).
import { ancestry, groupBox } from '../assemblies/ops'
import { worldBox, type Box } from '../model/geometry'
import type { Project, Vec3 } from '../model/types'

/** At 100% each offset is this many times the distance from the centre. */
export const EXPLODE_SCALE = 1
/** Parts inside a group spread this much of a loose part's distance. */
const INSIDE = 0.4

const centreOf = (b: Box): Vec3 => ({ x: (b.min.x + b.max.x) / 2, y: (b.min.y + b.max.y) / 2, z: (b.min.z + b.max.z) / 2 })
/** The box around every part. */
export const designBox = (boards: Project['boards']) => unionBox(boards.map(worldBox))

function unionBox(boxes: Box[]): Box | null {
  if (!boxes.length) return null
  return {
    min: { x: Math.min(...boxes.map(b => b.min.x)), y: Math.min(...boxes.map(b => b.min.y)), z: Math.min(...boxes.map(b => b.min.z)) },
    max: { x: Math.max(...boxes.map(b => b.max.x)), y: Math.max(...boxes.map(b => b.max.y)), z: Math.max(...boxes.map(b => b.max.z)) }
  }
}

/**
 * Offsets for an exploded view, 0..1. Top-level groups move out from the design's centre as units; each part
 * also moves out from its own top-level group's centre (or the design's, for a loose part).
 */
export function explodeOffsets(p: Project, amount: number): Map<string, Vec3> {
  const out = new Map<string, Vec3>()
  const all = unionBox(p.boards.map(worldBox))
  if (!all || amount <= 0) return out
  const k = Math.min(1, amount) * EXPLODE_SCALE
  const c = centreOf(all)
  const tops = new Map<string, Vec3>()
  for (const b of p.boards) {
    const chain = ancestry(p, b.groupId)
    const top = chain[chain.length - 1]
    const bc = centreOf(worldBox(b))
    let off: Vec3
    if (top) {
      if (!tops.has(top.id)) tops.set(top.id, centreOf(groupBox(p, top.id)!))
      const gc = tops.get(top.id)!
      // The group moves out as a unit; its own parts open up less, so the group still reads as one.
      const g = { x: (gc.x - c.x) * k, y: (gc.y - c.y) * k, z: (gc.z - c.z) * k }
      off = { x: g.x + (bc.x - gc.x) * k * INSIDE, y: g.y + (bc.y - gc.y) * k * INSIDE, z: g.z + (bc.z - gc.z) * k * INSIDE }
    } else off = { x: (bc.x - c.x) * k, y: (bc.y - c.y) * k, z: (bc.z - c.z) * k }
    out.set(b.id, off)
  }
  return out
}
