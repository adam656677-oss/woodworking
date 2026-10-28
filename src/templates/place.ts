// Helpers for templates: make boards in standard orientations, placed by their world-space corner.
import { faceToward, worldBox } from '../model/geometry'
import { newId } from '../model/ids'
import type { Board, ButtParams, GrooveParams, Joint, Vec3, Wood } from '../model/types'
import { snap64 } from '../model/units'

/**
 * Orientations (world: x = left→right, y = front→back, z = up). Each rotation was solved so the
 * local axes land as named; the board's position is then set so its world box starts at `min`.
 */
export const ORIENT = {
  /** Lying flat, length along x. */
  flatX: { x: 0, y: 0, z: -90 },
  /** Lying flat, length along y. */
  flatY: { x: 0, y: 0, z: 0 },
  /** Wall facing front/back: length along x, width up. */
  wallX: { x: -90, y: 0, z: -90 },
  /** Wall facing left/right: length along y, width up. */
  wallY: { x: 0, y: -90, z: 0 },
  /** Upright facing left/right: length up, width along y. */
  uprightY: { x: 90, y: 90, z: 0 },
  /** Upright facing front/back: length up, width along x. */
  uprightX: { x: 90, y: 0, z: 0 }
} satisfies Record<string, Vec3>

export function makeBoard(
  name: string,
  wood: Wood,
  width: number,
  length: number,
  orient: Vec3,
  min: Vec3,
  extra: Partial<Board> = {}
): Board {
  const b: Board = {
    id: newId('b'),
    name,
    woodId: wood.id,
    thickness: wood.thickness,
    width: snap64(width),
    length: snap64(length),
    position: { x: 0, y: 0, z: 0 },
    rotation: { ...orient },
    grain: 'length',
    holes: [],
    endCuts: { start: { miter: 0, bevel: 0 }, end: { miter: 0, bevel: 0 } },
    edgeBevels: { left: 0, right: 0 },
    ...extra
  }
  const at0 = worldBox(b)
  b.position = { x: min.x - at0.min.x, y: min.y - at0.min.y, z: min.z - at0.min.z }
  return b
}

export function butt(host: Board, partner: Board, params: ButtParams = { fastener: 'glue', count: 0 }): Joint {
  return { id: newId('j'), type: 'butt', hostBoardId: host.id, partnerBoardId: partner.id, params }
}

export function groove(type: 'dado' | 'rabbet', host: Board, partner: Board, p: Omit<GrooveParams, 'face'>): Joint {
  return {
    id: newId('j'),
    type,
    hostBoardId: host.id,
    partnerBoardId: partner.id,
    params: { ...p, width: snap64(p.width), depth: snap64(p.depth), offset: snap64(p.offset), face: faceToward(host, partner) }
  }
}

export function woodOf(woods: Wood[], id: string): Wood {
  const w = woods.find(x => x.id === id)
  if (!w) throw new Error(`Wood ${id} is not in this project's library`)
  return w
}
