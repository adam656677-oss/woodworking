// The door maker: slab, Shaker, raised-panel and glass doors for an opening, with hinges and a pull.
import { makeBoard, ORIENT } from '../templates/place'
import type { Board, HardwareUse, Hole, Joint, Project } from '../model/types'
import { snap64 } from '../model/units'
import { addHardware, PULL_CC } from './hardware'
import { addAsGroup, edgeGroove, edgeRabbet, edgeToward, endRabbet, endToward, faceLooking, joint, nextName, sixteenth, woodById, type Opening, centreOf } from './build'

export type DoorStyle = 'slab' | 'shaker' | 'raised' | 'glass'
export type Mounting = 'full' | 'half' | 'inset'
export type PullPlace = 'upper' | 'lower' | 'centre'
export type DoorOptions = {
  style: DoorStyle
  mounting: Mounting
  pair: boolean
  /** Which side the hinges are on (a pair is hinged on both outer sides). */
  hinge: 'left' | 'right'
  stile: number
  rail: number
  frameWood: string
  panelWood: string
  /** A pull item id ('knob', 'pull-96'…) or none. */
  pull: string | null
  pullPlace: PullPlace
}

export const DOOR_DEFAULTS: DoorOptions = {
  style: 'shaker', mounting: 'full', pair: false, hinge: 'left', stile: 2.25, rail: 2.25, frameWood: 'hw-4-4', panelWood: 'ply-1-4', pull: 'knob', pullPlace: 'upper'
}

export const GROOVE = { width: 0.25, depth: 0.375 }
const TENON = 0.375
const GLASS_RABBET = 0.375
const RAISE_BAND = 1.25
const CUP = { diameter: 1.375, depth: 0.5, fromEdge: 0.875, fromEnd: 4 }
const PULL_HOLE = 0.1875

/** How much a door laps the opening on each side (negative = gap inside it). */
export const lap = (m: Mounting) => (m === 'full' ? 0.5 : m === 'half' ? 0.25 : -sixteenth)
export const hingeItem = (m: Mounting) => (m === 'full' ? 'hinge-full' : m === 'half' ? 'hinge-half' : 'hinge-inset')
export const hingeCount = (h: number) => (h <= 40 ? 2 : h <= 60 ? 3 : 4)
/** Hinge cup heights from the bottom of the door: 4" from each end, the rest spread evenly. */
export function hingeHeights(h: number): number[] {
  const n = hingeCount(h)
  return Array.from({ length: n }, (_, i) => snap64(CUP.fromEnd + ((h - 2 * CUP.fromEnd) * i) / (n - 1)))
}

/** The doors' sizes and lower-left-front corners for an opening (one or a pair). */
export function doorRects(o: Opening, opts: Pick<DoorOptions, 'mounting' | 'pair'>, thickness: number): { x: number; y: number; z: number; width: number; height: number }[] {
  const l = lap(opts.mounting)
  const w = o.width + 2 * l, h = o.height + 2 * l
  const x = o.x - l, z = o.z - l
  // Overlay doors sit in front of the opening; inset doors inside it, flush with the front.
  const y = opts.mounting === 'inset' ? o.y : o.y - thickness
  if (!opts.pair) return [{ x, y, z, width: snap64(w), height: snap64(h) }]
  const gap = opts.mounting === 'inset' ? sixteenth : 0.125
  const each = snap64((w - gap) / 2)
  return [{ x, y, z, width: each, height: snap64(h) }, { x: snap64(x + each + gap), y, z, width: each, height: snap64(h) }]
}

export function addDoors(p0: Project, o: Opening, opts: DoorOptions): { project: Project; groupIds: string[] } | { error: string } {
  if (!(o.width > 0 && o.height > 0)) return { error: 'Give the opening a width and a height' }
  const frame = woodById(p0, opts.style === 'slab' ? opts.panelWood : opts.frameWood)
  if ('error' in frame) return frame
  const panel = opts.style === 'shaker' || opts.style === 'raised' ? woodById(p0, opts.panelWood) : frame
  if ('error' in panel) return panel
  const rects = doorRects(o, opts, frame.thickness)
  if (opts.style !== 'slab' && rects.some(r => r.width < 2 * opts.stile + 2 || r.height < 2 * opts.rail + 2)) return { error: 'The opening is too small for those stiles and rails' }
  let p = p0
  const groupIds: string[] = []
  rects.forEach((r, i) => {
    const hinge: 'left' | 'right' = opts.pair ? (i === 0 ? 'left' : 'right') : opts.hinge
    const made = makeDoor(r, opts, frame, panel, hinge)
    const name = nextName(p, 'Door')
    // The hinge line: the door's front corner on the hinge side. (A concealed hinge carries the door forward as it
    // opens, so its back edge never swings into the cabinet side; turning about the front corner does the same.)
    const origin = { x: hinge === 'left' ? r.x : r.x + r.width, y: r.y, z: r.z }
    const g = addAsGroup(p, made.boards, made.joints, name, { kind: 'swing', origin, maxDeg: 95, dir: hinge === 'left' ? -1 : 1 })
    p = g.project
    groupIds.push(g.id)
    for (const h of made.hardware) p = addHardware(p, { ...h, groupId: g.id })
  })
  return { project: p, groupIds }
}

type Rect = { x: number; y: number; z: number; width: number; height: number }
type Wd = Parameters<typeof makeBoard>[1]

function makeDoor(r: Rect, opts: DoorOptions, frame: Wd, panel: Wd, hinge: 'left' | 'right') {
  const boards: Board[] = [], joints: Joint[] = []
  const hardware: Omit<HardwareUse, 'id'>[] = []
  const T = frame.thickness
  const front = { x: 0, y: -1, z: 0 }
  // The part that takes the hinges and the one that takes the pull.
  let hingePart: Board, pullPart: Board
  if (opts.style === 'slab') {
    const door = makeBoard('Door', frame, r.width, r.height, ORIENT.uprightX, r)
    boards.push(door)
    hingePart = pullPart = door
  } else {
    const sw = opts.stile, rw = opts.rail
    const left = makeBoard('Stile', frame, sw, r.height, ORIENT.uprightX, r)
    const right = makeBoard('Stile', frame, sw, r.height, ORIENT.uprightX, { ...r, x: r.x + r.width - sw })
    const tenon = opts.style === 'glass' ? 0 : TENON
    const railLen = r.width - 2 * sw + 2 * tenon
    const bottom = makeBoard('Rail', frame, rw, railLen, ORIENT.wallX, { x: r.x + sw - tenon, y: r.y, z: r.z })
    const top = makeBoard('Rail', frame, rw, railLen, ORIENT.wallX, { x: r.x + sw - tenon, y: r.y, z: r.z + r.height - rw })
    boards.push(left, right, bottom, top)
    const stiles = [left, right], rails = [bottom, top]
    const inner = { x: r.x + r.width / 2, y: r.y + T / 2, z: r.z + r.height / 2 }
    if (opts.style === 'glass') {
      // Rails butt between the stiles; a 3/8" × 3/8" rabbet at the back of every inside edge holds the glass.
      for (const rl of rails) for (const s of stiles) joints.push(joint('butt', s, rl, { fastener: 'glue', count: 0 }))
      // Each glass rabbet names a frame part it meets (rails meet the left stile, stiles the bottom rail).
      for (const b of [...stiles, ...rails]) joints.push(edgeRabbet(b, b === left || b === right ? bottom : left, edgeToward(b, inner), faceLooking(b, { x: 0, y: 1, z: 0 }), GLASS_RABBET, GLASS_RABBET, true))
      const gw = snap64(r.width - 2 * sw + 2 * GLASS_RABBET - 2 * sixteenth), gh = snap64(r.height - 2 * rw + 2 * GLASS_RABBET - 2 * sixteenth)
      hardware.push({ itemId: 'glass-18', qty: 1, note: `${gw} × ${gh}` })
    } else {
      // The panel sits in a 1/4" × 3/8" groove (1/16" short each way); the rails' stub tenons fill the stile grooves.
      const into = GROOVE.depth - sixteenth
      const raised = opts.style === 'raised'
      const pw = r.width - 2 * sw + 2 * into, ph = r.height - 2 * rw + 2 * into
      const pt = panel.thickness
      const pan = makeBoard('Panel', panel, pw, ph, ORIENT.uprightX, { x: r.x + sw - into, y: r.y + (T - pt) / 2, z: r.z + rw - into }, raised ? { grain: 'length' } : {})
      boards.push(pan)
      for (const s of stiles) joints.push(edgeGroove(s, pan, GROOVE.width, GROOVE.depth))
      for (const rl of rails) joints.push(edgeGroove(rl, pan, GROOVE.width, GROOVE.depth))
      const cheek = snap64((T - GROOVE.width) / 2)
      for (const rl of rails) for (const s of stiles) {
        const end = endToward(rl, centreOf(s))
        joints.push(endRabbet(rl, s, end, 'top', TENON, cheek, true), endRabbet(rl, s, end, 'bottom', TENON, cheek, true))
      }
      if (raised) {
        // A raised panel: its edges are cut down to a 1/4" tongue — a wide, shallow step at the front (the raise),
        // a narrow one at the back.
        const tongue = snap64((pt - GROOVE.width) / 2)
        const frontFace = faceLooking(pan, front), backFace = frontFace === 'top' ? 'bottom' : 'top'
        for (const s of stiles) {
          const e = edgeToward(pan, centreOf(s))
          joints.push(edgeRabbet(pan, s, e, frontFace, into + RAISE_BAND, tongue, true), edgeRabbet(pan, s, e, backFace, into, tongue, true))
        }
        for (const rl of rails) {
          const e = endToward(pan, centreOf(rl))
          joints.push(endRabbet(pan, rl, e, frontFace, into + RAISE_BAND, tongue, true), endRabbet(pan, rl, e, backFace, into, tongue, true))
        }
      }
    }
    hingePart = hinge === 'left' ? left : right
    pullPart = hinge === 'left' ? right : left
  }
  // Hinge cups in the back of the hinge-side part.
  const cupU = edgeOf(hingePart, hinge) === 'left' ? CUP.fromEdge : hingePart.width - CUP.fromEdge
  const back = faceLooking(hingePart, { x: 0, y: 1, z: 0 })
  const cups: Hole[] = hingeHeights(r.height).map(h => ({ diameter: CUP.diameter, u: snap64(cupU), v: vFromBottom(hingePart, h), depth: CUP.depth, face: back }))
  hingePart.holes = [...hingePart.holes, ...cups]
  hardware.push({ itemId: hingeItem(opts.mounting), qty: cups.length }, { itemId: 'screw-6-58', qty: cups.length * 4 })
  if (opts.pull) {
    const latch = hinge === 'left' ? 'right' : 'left'
    const holes = pullHoles(pullPart, latch, r.height, opts.pull, opts.pullPlace, opts.style === 'slab')
    pullPart.holes = [...pullPart.holes, ...holes]
    hardware.push({ itemId: opts.pull, qty: 1 })
  }
  return { boards, joints, hardware }
}

/** Which local edge of an upright part is on the world left/right. */
function edgeOf(b: Board, side: 'left' | 'right'): 'left' | 'right' {
  const c = centreOf(b)
  return edgeToward(b, { ...c, x: side === 'left' ? c.x - 1000 : c.x + 1000 })
}
/** A height from the door's bottom as a position along the part's length. */
function vFromBottom(b: Board, h: number): number {
  return snap64(endToward(b, { ...centreOf(b), z: -1e6 }) === 'start' ? h : b.length - h)
}

/** Holes for a knob (one) or a bar pull (two, upright), 3" in from the corner or centred. */
export function pullHoles(b: Board, latch: 'left' | 'right', height: number, pull: string, place: PullPlace, slab: boolean): Hole[] {
  const cc = PULL_CC[pull] ?? 0
  const inFrom = slab ? 1.5 : b.width / 2
  const u = snap64(edgeOf(b, latch) === 'left' ? inFrom : b.width - inFrom)
  const top = place === 'upper' ? height - 3 : place === 'lower' ? 3 + cc : height / 2 + cc / 2
  const heights = cc ? [top, top - cc] : [place === 'centre' ? height / 2 : top]
  return heights.map(h => ({ diameter: PULL_HOLE, u, v: vFromBottom(b, h) }))
}
