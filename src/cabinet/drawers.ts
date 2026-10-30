// The drawer maker: a box sized for its slides, a bottom in a groove, an applied front and a pull.
import { addNote } from '../checks/annotations'
import { makeBoard, ORIENT } from '../templates/place'
import type { Board, HardwareUse, Hole, Joint, Project } from '../model/types'
import { snap64 } from '../model/units'
import { addHardware, PULL_CC } from './hardware'
import { addAsGroup, joint, nextName, seat, woodById, type Opening } from './build'
import { lap, type Mounting } from './doors'

export type SlideKind = 'side' | 'under' | 'runners'
export type BoxJoint = 'butt' | 'rabbet' | 'dado'
export type DrawerOptions = {
  slides: SlideKind
  joinery: BoxJoint
  boxWood: string
  bottomWood: string
  /** An applied (false) front, mounted like a door, or none. */
  front: Mounting | 'none'
  frontWood: string
  pull: string | null
}
export const DRAWER_DEFAULTS: DrawerOptions = { slides: 'side', joinery: 'rabbet', boxWood: 'ply-1-2', bottomWood: 'ply-1-4', front: 'full', frontWood: 'ply-3-4', pull: 'pull-96' }

export const SLIDE_NOTE = "Check your slide maker's instructions — sizes vary"
const SIDE_LENGTHS = [10, 12, 14, 16, 18, 20, 22, 24, 26, 28]
const UNDER_LENGTHS = [12, 15, 18, 21]
const GROOVE = 0.25
const BOTTOM_UP = 0.5
const DADO_IN = 0.5

/** The box's size for an opening and its slides (depth is the room behind any inset front). */
export function boxSize(o: Required<Pick<Opening, 'width' | 'height'>> & { depth: number }, slides: SlideKind): { width: number; height: number; depth: number; slide?: number } | { error: string } {
  const room = o.depth - 1
  if (slides === 'runners') return { width: snap64(o.width - 0.125), height: snap64(o.height - 0.125), depth: snap64(Math.floor(room * 2) / 2) }
  const lengths = slides === 'side' ? SIDE_LENGTHS : UNDER_LENGTHS
  const slide = [...lengths].reverse().find(l => l <= room + 1e-9)
  if (!slide) return { error: `The opening is too shallow for drawer slides (it needs to be at least ${lengths[0] + 1}" deep)` }
  return slides === 'side'
    ? { width: snap64(o.width - 1), height: snap64(o.height - 1), depth: slide, slide }
    : { width: snap64(o.width - 0.375), height: snap64(o.height - 13 / 16), depth: slide, slide }
}

export function addDrawer(p0: Project, o: Opening, opts: DrawerOptions): { project: Project; groupId: string } | { error: string } {
  if (!(o.width > 0 && o.height > 0 && (o.depth ?? 0) > 0)) return { error: 'Give the opening a width, a height and a depth' }
  const wood = woodById(p0, opts.boxWood)
  if ('error' in wood) return wood
  const bottomWood = woodById(p0, opts.bottomWood)
  if ('error' in bottomWood) return bottomWood
  const frontWood = opts.front === 'none' ? null : woodById(p0, opts.frontWood)
  if (frontWood && 'error' in frontWood) return frontWood
  const inset = opts.front === 'inset' ? frontWood!.thickness : 0
  const size = boxSize({ width: o.width, height: o.height, depth: o.depth! - inset }, opts.slides)
  if ('error' in size) return size
  const t = wood.thickness
  if (size.height < 2 || size.width < 4 * t + 2) return { error: 'The opening is too small for a drawer' }
  const x0 = o.x + (o.width - size.width) / 2, y0 = o.y + inset, z0 = o.z + (o.height - size.height) / 2
  const D = size.depth, W = size.width, H = size.height

  const boards: Board[] = [], joints: Joint[] = []
  const left = makeBoard('Drawer side', wood, H, D, ORIENT.wallY, { x: x0, y: y0, z: z0 })
  const right = makeBoard('Drawer side', wood, H, D, ORIENT.wallY, { x: x0 + W - t, y: y0, z: z0 })
  // Front and back: between the sides (butt), or into 1/2"-deep rabbets or dados in them.
  const into = opts.joinery === 'butt' ? 0 : t / 2
  const across = W - 2 * t + 2 * into
  const fy = opts.joinery === 'dado' ? y0 + DADO_IN : y0
  const by = opts.joinery === 'dado' ? y0 + D - DADO_IN - t : y0 + D - t
  const bx = x0 + t - into
  const front = makeBoard('Drawer front', wood, H, across, ORIENT.wallX, { x: bx, y: fy, z: z0 })
  const back = makeBoard('Drawer back', wood, H, across, ORIENT.wallX, { x: bx, y: by, z: z0 })
  boards.push(left, right, front, back)
  for (const s of [left, right]) for (const fb of [front, back]) {
    joints.push(opts.joinery === 'butt' ? joint('butt', s, fb, { fastener: 'screws', count: 2 }) : seat(opts.joinery, s, fb, 'width'))
  }
  // The bottom: in a 1/4" groove 1/2" up — 1/4" deep, or less in thin box wood (no more than half its thickness) —
  // 1/32" short of the groove bottom all round.
  const gd = Math.min(GROOVE, Math.floor((t / 2) * 32) / 32)
  const reach = gd - 1 / 32
  const bw = W - 2 * t + 2 * reach, bl = (by - (fy + t)) + 2 * reach
  const bottom = makeBoard('Drawer bottom', bottomWood, bw, bl, ORIENT.flatY, { x: x0 + t - reach, y: fy + t - reach, z: z0 + BOTTOM_UP })
  boards.push(bottom)
  for (const b of [left, right, front, back]) joints.push(seat('dado', b, bottom, 'length', { width: GROOVE, depth: gd }))

  const hardware: Omit<HardwareUse, 'id'>[] = []
  if (size.slide) hardware.push({ itemId: opts.slides === 'side' ? `slide-side-${size.slide}` : `slide-under-${size.slide}`, qty: 1 })
  let pullOn: Board = front
  let pw = across, ph = H
  if (frontWood && opts.front !== 'none') {
    const l = lap(opts.front)
    const fw = snap64(o.width + 2 * l), fh = snap64(o.height + 2 * l)
    const applied = makeBoard('Drawer face', frontWood, fw, fh, ORIENT.uprightX, { x: o.x - l, y: opts.front === 'inset' ? o.y : o.y - frontWood.thickness, z: o.z - l })
    boards.push(applied)
    joints.push(joint('butt', front, applied, { fastener: 'screws', count: 4 }))
    hardware.push({ itemId: 'screw-8-114', qty: 4 })
    pullOn = applied
    pw = fw; ph = fh
    // A dado box's front sits 1/2" back: the face screws to the sides' ends instead (still a butt).
    if (opts.joinery === 'dado') joints[joints.length - 1] = joint('butt', left, applied, { fastener: 'screws', count: 4 })
  }
  if (opts.pull) {
    pullOn.holes = [...pullOn.holes, ...drawerPullHoles(pullOn, pw, ph, opts.pull)]
    hardware.push({ itemId: opts.pull, qty: 1 })
  }
  const travel = size.slide ?? Math.max(0, D - 2)
  const name = nextName(p0, 'Drawer')
  const g = addAsGroup(p0, boards, joints, name, { kind: 'slide', dir: { x: 0, y: -1, z: 0 }, travel })
  let p = g.project
  for (const h of hardware) p = addHardware(p, { ...h, groupId: g.id })
  const note = addNote(p, { x: x0 + W / 2, y: y0, z: z0 + H }, `${name}: ${SLIDE_NOTE}`)
  if (!('error' in note)) p = note.project
  return { project: p, groupId: g.id }
}

/** A drawer pull is centred; a bar pull runs across. */
function drawerPullHoles(b: Board, width: number, _height: number, pull: string): Hole[] {
  const cc = PULL_CC[pull] ?? 0
  // Across the part's width when it stands upright (an applied face); along its length when it lies as a wall.
  const upright = width === b.width
  const mid = { u: b.width / 2, v: b.length / 2 }
  if (!cc) return [{ diameter: 0.1875, u: snap64(mid.u), v: snap64(mid.v) }]
  return upright
    ? [{ diameter: 0.1875, u: snap64(mid.u - cc / 2), v: snap64(mid.v) }, { diameter: 0.1875, u: snap64(mid.u + cc / 2), v: snap64(mid.v) }]
    : [{ diameter: 0.1875, u: snap64(mid.u), v: snap64(mid.v - cc / 2) }, { diameter: 0.1875, u: snap64(mid.u), v: snap64(mid.v + cc / 2) }]
}
