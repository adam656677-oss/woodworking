import type { Board, Joint, Wood } from '../model/types'
import type { TemplateDef } from './index'
import { butt, groove, makeBoard, ORIENT, woodOf } from './place'

/** A simple open box (optional lid): front/back run full width; sides fit between (butt) or into rabbets. */
export const box: TemplateDef = {
  id: 'box',
  name: 'Box',
  params: [
    { key: 'W', label: 'Width (outside)', kind: 'inches', default: 12, min: 2, max: 96 },
    { key: 'D', label: 'Depth (outside)', kind: 'inches', default: 8, min: 2, max: 96 },
    { key: 'H', label: 'Height', kind: 'inches', default: 6, min: 1, max: 96 },
    { key: 'wood', label: 'Wood', kind: 'wood', default: 'hw-4-4' },
    { key: 'lid', label: 'Lid', kind: 'bool', default: false },
    { key: 'corners', label: 'Corners', kind: 'choice', default: 'butt', options: ['butt', 'rabbet'] }
  ],
  build(params, woods: Wood[]) {
    const W = params.W as number
    const D = params.D as number
    const H = params.H as number
    const wood = woodOf(woods, params.wood as string)
    const T = wood.thickness
    const rabbet = params.corners === 'rabbet'
    const depth = T / 2

    const front = makeBoard('Front', wood, H, W, ORIENT.wallX, { x: 0, y: 0, z: 0 })
    const back = makeBoard('Back', wood, H, W, ORIENT.wallX, { x: 0, y: D - T, z: 0 })
    const sideLen = rabbet ? D - 2 * (T - depth) : D - 2 * T
    const sideY = rabbet ? T - depth : T
    const left = makeBoard('Side', wood, H, sideLen, ORIENT.wallY, { x: 0, y: sideY, z: 0 })
    const right = makeBoard('Side', wood, H, sideLen, ORIENT.wallY, { x: W - T, y: sideY, z: 0 })
    const bottom = makeBoard('Bottom', wood, D - 2 * T, W - 2 * T, ORIENT.flatX, { x: T, y: T, z: 0 })
    const boards: Board[] = [front, back, left, right, bottom]

    const joints: Joint[] = []
    for (const wall of [front, back]) {
      for (const side of [left, right]) {
        if (rabbet) {
          const atStart = side === left
          joints.push(groove('rabbet', wall, side, { width: T, depth, offset: atStart ? 0 : W - T, along: 'width' }))
        } else {
          joints.push(butt(wall, side))
        }
      }
      joints.push(butt(wall, bottom))
    }
    joints.push(butt(left, bottom), butt(right, bottom))

    if (params.lid) boards.push(makeBoard('Lid', wood, D, W, ORIENT.flatX, { x: 0, y: 0, z: H }))
    return { boards, joints }
  }
}
