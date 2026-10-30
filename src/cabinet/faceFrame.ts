// The face-frame maker: stiles, rails, and mid stiles and rails for equal openings.
import { makeBoard, ORIENT } from '../templates/place'
import type { Board, Joint, Project } from '../model/types'
import { snap64 } from '../model/units'
import { addHardware } from './hardware'
import { addAsGroup, joint, woodById, type Opening } from './build'

export type FaceFrameOptions = {
  stile: number; topRail: number; bottomRail: number
  /** Mid stiles across (columns − 1) and mid rails down (rows − 1). */
  midStiles: number; midRails: number
  joinery: 'pocketScrew' | 'butt'
  wood: string
}
export const FRAME_DEFAULTS: FaceFrameOptions = { stile: 1.5, topRail: 1.5, bottomRail: 1.5, midStiles: 0, midRails: 0, joinery: 'pocketScrew', wood: 'hw-4-4' }

/** The clear openings of a face frame (left to right, bottom to top), as openings for doors and drawers. */
export function frameOpenings(o: Opening, f: FaceFrameOptions, thickness: number): Opening[] {
  const cols = f.midStiles + 1, rows = f.midRails + 1
  const cw = (o.width - 2 * f.stile - f.midStiles * f.stile) / cols
  const rh = (o.height - f.topRail - f.bottomRail - f.midRails * f.bottomRail) / rows
  const out: Opening[] = []
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    out.push({ x: snap64(o.x + f.stile + c * (cw + f.stile)), y: snap64(o.y + thickness), z: snap64(o.z + f.bottomRail + r * (rh + f.bottomRail)), width: snap64(cw), height: snap64(rh) })
  }
  return out
}

/** A face frame whose lower-left-front corner is at the opening's corner, `width × height` outside. */
export function addFaceFrame(p0: Project, o: Opening, f: FaceFrameOptions): { project: Project; groupId: string } | { error: string } {
  const wood = woodById(p0, f.wood)
  if ('error' in wood) return wood
  const openings = frameOpenings(o, f, wood.thickness)
  if (openings.some(x => x.width < 1 || x.height < 1)) return { error: 'The frame is too small for that many openings' }
  const boards: Board[] = [], joints: Joint[] = []
  const at = (x: number, z: number) => ({ x, y: o.y, z })
  const inner = o.height - f.topRail - f.bottomRail
  const left = makeBoard('Stile', wood, f.stile, o.height, ORIENT.uprightX, at(o.x, o.z))
  const right = makeBoard('Stile', wood, f.stile, o.height, ORIENT.uprightX, at(o.x + o.width - f.stile, o.z))
  const between = o.width - 2 * f.stile
  const bottom = makeBoard('Bottom rail', wood, f.bottomRail, between, ORIENT.wallX, at(o.x + f.stile, o.z))
  const top = makeBoard('Top rail', wood, f.topRail, between, ORIENT.wallX, at(o.x + f.stile, o.z + o.height - f.topRail))
  boards.push(left, right, bottom, top)
  let pocket = 0
  const join = (host: Board, partner: Board, railWidth: number) => {
    if (f.joinery === 'butt') joints.push(joint('butt', host, partner, { fastener: 'glue', count: 0 }))
    else {
      const count = railWidth >= 2.5 ? 3 : 2
      pocket += count
      joints.push(joint('pocketScrew', host, partner, { count, spacing: snap64(Math.max(0.75, railWidth - 1) / (count - 1)), screwLength: 1.25 }))
    }
  }
  for (const s of [left, right]) { join(s, bottom, f.bottomRail); join(s, top, f.topRail) }
  // Mid stiles run between the rails; mid rails between the stiles of each column.
  const cols = [left]
  for (let c = 1; c <= f.midStiles; c++) {
    const x = openings[c].x - f.stile
    const m = makeBoard('Mid stile', wood, f.stile, inner, ORIENT.uprightX, at(x, o.z + f.bottomRail))
    boards.push(m)
    join(bottom, m, f.stile); join(top, m, f.stile)
    cols.push(m)
  }
  cols.push(right)
  const cw = openings[0].width
  for (let r = 1; r <= f.midRails; r++) {
    const z = openings[r * (f.midStiles + 1)].z - f.bottomRail
    for (let c = 0; c <= f.midStiles; c++) {
      const m = makeBoard('Mid rail', wood, f.bottomRail, cw, ORIENT.wallX, at(openings[c].x, z))
      boards.push(m)
      join(cols[c], m, f.bottomRail); join(cols[c + 1], m, f.bottomRail)
    }
  }
  const g = addAsGroup(p0, boards, joints, 'Face frame')
  const p = pocket ? addHardware(g.project, { itemId: 'pocket-114', qty: pocket, groupId: g.id }) : g.project
  return { project: p, groupId: g.id }
}
