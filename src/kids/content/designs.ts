// The 3D designs of the starter projects, built with the same helpers as the Master Shop templates.
// Every part is a straight crosscut from standard lumber (no ripping), so a kid can cut it in a miter box.
import type { Board, ButtParams, Joint, Project } from '../../model/types'
import { emptyProject } from '../../model/woods'
import { butt, makeBoard, ORIENT, woodOf } from '../../templates/place'

const GLUE: ButtParams = { fastener: 'glue', count: 0 }
const nails = (count: number): ButtParams => ({ fastener: 'nails', count })
const screws = (count: number): ButtParams => ({ fastener: 'screws', count })

type Built = { boards: Board[]; joints: Joint[] }

function pencilHolder(p: Project): Built {
  const w = woodOf(p.woods, '1x4')
  const H = 4
  // Front and back run the full 3-1/2" width; the sides fit between them; the bottom fits inside.
  const front = makeBoard('Front', w, 3.5, H, ORIENT.uprightX, { x: 0, y: 0, z: 0 })
  const back = makeBoard('Back', w, 3.5, H, ORIENT.uprightX, { x: 0, y: 4.25, z: 0 })
  const left = makeBoard('Side', w, 3.5, H, ORIENT.uprightY, { x: 0, y: 0.75, z: 0 })
  const right = makeBoard('Side', w, 3.5, H, ORIENT.uprightY, { x: 2.75, y: 0.75, z: 0 })
  const bottom = makeBoard('Bottom', w, 3.5, 2, ORIENT.flatX, { x: 0.75, y: 0.75, z: 0 })
  return {
    boards: [front, back, left, right, bottom],
    joints: [
      butt(front, left, nails(2)), butt(front, right, nails(2)), butt(back, left, nails(2)), butt(back, right, nails(2)),
      butt(left, bottom, GLUE), butt(right, bottom, GLUE), butt(front, bottom, GLUE), butt(back, bottom, GLUE)
    ]
  }
}

function ticTacToe(p: Project): Built {
  const w10 = woodOf(p.woods, '1x10')
  const w2 = woodOf(p.woods, '1x2')
  const S = 9.25
  const base = makeBoard('Base', w10, S, S, ORIENT.flatX, { x: 0, y: 0, z: 0 })
  const lines = [2.125, 5.625] // where each 1-1/2" strip starts: squares of 2-1/8", 2" and 2-1/8"
  const z = 0.75
  const boards: Board[] = [base]
  const joints: Joint[] = []
  // Two long strips run left to right; short strips fill the gaps between them the other way.
  for (const y of lines) {
    const s = makeBoard('Long strip', w2, 1.5, S, ORIENT.flatX, { x: 0, y, z })
    boards.push(s)
    joints.push(butt(base, s, GLUE))
  }
  const gaps: [number, number][] = [[0, 2.125], [3.625, 5.625], [7.125, S]]
  for (const x of lines) {
    for (const [y0, y1] of gaps) {
      const s = makeBoard('Short strip', w2, 1.5, y1 - y0, ORIENT.flatY, { x, y: y0, z })
      boards.push(s)
      joints.push(butt(base, s, GLUE))
    }
  }
  return { boards, joints }
}

function birdhouse(p: Project): Built {
  const w6 = woodOf(p.woods, '1x6')
  const w8 = woodOf(p.woods, '1x8')
  const H = 8
  const front = makeBoard('Front', w6, 5.5, H, ORIENT.uprightX, { x: 0, y: 0, z: 0 }, { holes: [{ diameter: 1.25, u: 2.75, v: 6 }] })
  const back = makeBoard('Back', w6, 5.5, H, ORIENT.uprightX, { x: 0, y: 6.25, z: 0 })
  const left = makeBoard('Side', w6, 5.5, H, ORIENT.uprightY, { x: 0, y: 0.75, z: 0 })
  const right = makeBoard('Side', w6, 5.5, H, ORIENT.uprightY, { x: 4.75, y: 0.75, z: 0 })
  // Four 1/4" drain holes in the floor keep rain from pooling.
  const drains = [1, 4.5].flatMap(u => [1, 3].map(v => ({ diameter: 0.25, u, v })))
  const floor = makeBoard('Floor', w6, 5.5, 4, ORIENT.flatX, { x: 0.75, y: 0.75, z: 0 }, { holes: drains })
  const roof = makeBoard('Roof', w8, 7.25, 7.5, ORIENT.flatX, { x: -1, y: -0.125, z: H })
  return {
    boards: [front, back, left, right, floor, roof],
    joints: [
      butt(front, left, nails(3)), butt(front, right, nails(3)), butt(back, left, nails(3)), butt(back, right, nails(3)),
      butt(left, floor, nails(2)), butt(right, floor, nails(2)),
      // The roof is screwed on so it can come off to clean the house out each year.
      butt(roof, front, screws(2)), butt(roof, back, screws(2))
    ]
  }
}

function pictureFrame(p: Project): Built {
  const w = woodOf(p.woods, '1x3')
  // Opening 6-1/2" × 4-1/2" so a 5×7 photo taped behind overlaps by 1/4" all round.
  const top = makeBoard('Rail', w, 2.5, 11.5, ORIENT.flatX, { x: 0, y: 7, z: 0 })
  const bottom = makeBoard('Rail', w, 2.5, 11.5, ORIENT.flatX, { x: 0, y: 0, z: 0 })
  const left = makeBoard('Stile', w, 2.5, 4.5, ORIENT.flatY, { x: 0, y: 2.5, z: 0 })
  const right = makeBoard('Stile', w, 2.5, 4.5, ORIENT.flatY, { x: 9, y: 2.5, z: 0 })
  return {
    boards: [top, bottom, left, right],
    // Glued corners, held by a flat mending plate screwed across each corner on the back.
    joints: [butt(top, left, GLUE), butt(top, right, GLUE), butt(bottom, left, GLUE), butt(bottom, right, GLUE)]
  }
}

function toolbox(p: Project): Built {
  const w6 = woodOf(p.woods, '1x6')
  const w2 = woodOf(p.woods, '1x2')
  const L = 16
  const bottom = makeBoard('Bottom', w6, 5.5, L, ORIENT.flatX, { x: 0, y: 0, z: 0 })
  const endA = makeBoard('End', w6, 5.5, 8, ORIENT.uprightY, { x: 0, y: 0, z: 0.75 })
  const endB = makeBoard('End', w6, 5.5, 8, ORIENT.uprightY, { x: L - 0.75, y: 0, z: 0.75 })
  const front = makeBoard('Side', w6, 5.5, L - 1.5, ORIENT.wallX, { x: 0.75, y: 0, z: 0.75 })
  const back = makeBoard('Side', w6, 5.5, L - 1.5, ORIENT.wallX, { x: 0.75, y: 4.75, z: 0.75 })
  const handle = makeBoard('Handle', w2, 1.5, L - 1.5, ORIENT.wallX, { x: 0.75, y: 2.375, z: 7.25 })
  return {
    boards: [bottom, endA, endB, front, back, handle],
    joints: [
      butt(endA, front, screws(2)), butt(endA, back, screws(2)), butt(endB, front, screws(2)), butt(endB, back, screws(2)),
      butt(bottom, endA, screws(2)), butt(bottom, endB, screws(2)), butt(bottom, front, screws(3)), butt(bottom, back, screws(3)),
      butt(endA, handle, screws(1)), butt(endB, handle, screws(1))
    ]
  }
}

function finishSampler(p: Project): Built {
  // One 1x6 board, marked into four boxes for four finishes.
  const board = makeBoard('Sampler board', woodOf(p.woods, '1x6'), 5.5, 16, ORIENT.flatX, { x: 0, y: 0, z: 0 })
  return { boards: [board], joints: [] }
}

function coasters(p: Project): Built {
  // Four 3-1/2" squares from a 1x4, laid out side by side for the picture.
  const w = woodOf(p.woods, '1x4')
  return { boards: [0, 1, 2, 3].map(i => makeBoard('Coaster', w, 3.5, 3.5, ORIENT.flatX, { x: i * 4.5, y: 0, z: 0 })), joints: [] }
}

function bookends(p: Project): Built {
  // Each bookend: a 6" base and a 6" upright standing on its end, screwed up from underneath. Two of them.
  const w = woodOf(p.woods, '1x6')
  const boards: Board[] = [], joints: Joint[] = []
  for (const x of [0, 10]) {
    const base = makeBoard('Base', w, 5.5, 6, ORIENT.flatY, { x, y: 0, z: 0 })
    const upright = makeBoard('Upright', w, 5.5, 6, ORIENT.uprightX, { x, y: 0, z: 0.75 })
    boards.push(base, upright)
    joints.push(butt(base, upright, screws(2)))
  }
  return { boards, joints }
}

function planter(p: Project): Built {
  // A box from 1x6: ends between the sides, a bottom inside with drain holes, all screwed for the outdoors.
  const w = woodOf(p.woods, '1x6')
  const L = 14
  const front = makeBoard('Side', w, 5.5, L, ORIENT.wallX, { x: 0, y: 0, z: 0 })
  const back = makeBoard('Side', w, 5.5, L, ORIENT.wallX, { x: 0, y: 6.25, z: 0 })
  const endA = makeBoard('End', w, 5.5, 5.5, ORIENT.wallY, { x: 0, y: 0.75, z: 0 })
  const endB = makeBoard('End', w, 5.5, 5.5, ORIENT.wallY, { x: L - 0.75, y: 0.75, z: 0 })
  const holes = [3, 6.25, 9.5].map(v => ({ diameter: 0.5, u: 2.75, v }))
  // Set 3/4" up inside the box so water drains out underneath.
  const bottom = makeBoard('Bottom', w, 5.5, L - 1.5, ORIENT.flatX, { x: 0.75, y: 0.75, z: 0.75 }, { holes })
  return {
    boards: [front, back, endA, endB, bottom],
    joints: [
      butt(front, endA, screws(2)), butt(front, endB, screws(2)), butt(back, endA, screws(2)), butt(back, endB, screws(2)),
      butt(front, bottom, screws(3)), butt(back, bottom, screws(3))
    ]
  }
}

function phoneStand(p: Project): Built {
  // A 1x4 base, a 1x2 lip glued on at the front to stop the phone sliding, and a 1x4 back to lean on.
  const w4 = woodOf(p.woods, '1x4')
  const w2 = woodOf(p.woods, '1x2')
  const base = makeBoard('Base', w4, 3.5, 5.5, ORIENT.flatY, { x: 0, y: 0, z: 0 })
  const lip = makeBoard('Lip', w2, 1.5, 3.5, ORIENT.flatX, { x: 0, y: 0, z: 0.75 })
  const back = makeBoard('Back', w4, 3.5, 5, ORIENT.uprightX, { x: 0, y: 4.75, z: 0.75 })
  return { boards: [base, lip, back], joints: [butt(base, lip, GLUE), butt(base, back, screws(2))] }
}

export const DESIGNS: Record<string, (p: Project) => Built> = {
  coasters, bookends, planter, 'phone-stand': phoneStand,
  'pencil-holder': pencilHolder,
  'tic-tac-toe': ticTacToe,
  birdhouse,
  'picture-frame': pictureFrame,
  toolbox,
  'finish-sampler': finishSampler
}

/** A fresh project holding the starter project's design. */
export function buildDesign(id: string, name: string): Project {
  const build = DESIGNS[id]
  if (!build) throw new Error(`No design for ${id}`)
  const p = emptyProject(name)
  return { ...p, ...build(p) }
}
