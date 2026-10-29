import type { Joint, Wood } from '../model/types'
import { num, woodT, type TemplateDef, type UnlockForm } from './index'
import { butt, makeBoard, ORIENT, woodOf } from './place'

const SCREWS = { fastener: 'screws' as const, count: 2 }
const HOLE_FROM_BOTTOM = 6

/** A simple birdhouse: floor between the walls, front/back overlap the sides, flat roof with overhang. */
export const birdhouse: TemplateDef = {
  id: 'birdhouse',
  name: 'Birdhouse',
  params: [
    { key: 'floorW', label: 'Floor width', kind: 'inches', default: 5, min: 3, max: 12 },
    { key: 'floorD', label: 'Floor depth', kind: 'inches', default: 5, min: 3, max: 12 },
    { key: 'height', label: 'Wall height', kind: 'inches', default: 8, min: 4, max: 16 },
    { key: 'overhang', label: 'Roof overhang', kind: 'inches', default: 1, min: 0, max: 4 },
    { key: 'hole', label: 'Entry hole diameter', kind: 'inches', default: 1.25, min: 0.75, max: 3 },
    { key: 'wood', label: 'Wood', kind: 'wood', default: '1x10' }
  ],
  unlockForm(params): UnlockForm {
    const side = { width: '=FloorD', length: '=Height', y: '=T' }
    return {
      sizes: [
        { name: 'FloorW', expr: num(params.floorW as number) }, { name: 'FloorD', expr: num(params.floorD as number) },
        { name: 'Height', expr: num(params.height as number) }, { name: 'Overhang', expr: num(params.overhang as number) },
        { name: 'Hole', expr: num(params.hole as number) }, { name: 'T', expr: woodT(params.wood as string) },
        { name: 'OuterW', expr: 'FloorW + 2*T' }, { name: 'OuterD', expr: 'FloorD + 2*T' }
      ],
      boards: {
        0: { width: '=OuterW', length: '=Height', 'holes.0.diameter': '=Hole', 'holes.0.u': '=OuterW/2', 'holes.0.v': `=min(${HOLE_FROM_BOTTOM}, Height - Hole)` },
        1: { width: '=OuterW', length: '=Height', y: '=OuterD - T' },
        2: side,
        3: { ...side, x: '=OuterW - T' },
        4: { width: '=FloorD', length: '=FloorW', x: '=T', y: '=T' },
        5: { width: '=OuterD + 2*Overhang', length: '=OuterW + 2*Overhang', x: '=-Overhang', y: '=-Overhang', z: '=Height' }
      }
    }
  },
  build(params, woods: Wood[]) {
    const fw = params.floorW as number
    const fd = params.floorD as number
    const h = params.height as number
    const o = params.overhang as number
    const wood = woodOf(woods, params.wood as string)
    const T = wood.thickness
    const outerW = fw + 2 * T
    const outerD = fd + 2 * T

    const holeV = Math.min(HOLE_FROM_BOTTOM, h - (params.hole as number))
    const front = makeBoard('Front', wood, outerW, h, ORIENT.uprightX, { x: 0, y: 0, z: 0 }, {
      holes: [{ diameter: params.hole as number, u: outerW / 2, v: holeV }]
    })
    const back = makeBoard('Back', wood, outerW, h, ORIENT.uprightX, { x: 0, y: outerD - T, z: 0 })
    const left = makeBoard('Side', wood, fd, h, ORIENT.uprightY, { x: 0, y: T, z: 0 })
    const right = makeBoard('Side', wood, fd, h, ORIENT.uprightY, { x: outerW - T, y: T, z: 0 })
    const floor = makeBoard('Floor', wood, fd, fw, ORIENT.flatX, { x: T, y: T, z: 0 })
    const roof = makeBoard('Roof', wood, outerD + 2 * o, outerW + 2 * o, ORIENT.flatX, { x: -o, y: -o, z: h })

    const joints: Joint[] = []
    for (const wall of [front, back]) {
      joints.push(butt(wall, left, SCREWS), butt(wall, right, SCREWS), butt(wall, floor, SCREWS))
    }
    joints.push(butt(left, floor, SCREWS), butt(right, floor, SCREWS))
    for (const wall of [front, back, left, right]) joints.push(butt(roof, wall, SCREWS))
    return { boards: [front, back, left, right, floor, roof], joints }
  }
}
