import type { Board, Joint, Wood } from '../model/types'
import { snap64 } from '../model/units'
import type { TemplateDef } from './index'
import { groove, makeBoard, ORIENT, woodOf } from './place'

const DADO_DEPTH_MAX = 0.25
const BACK_RABBET_DEPTH_MAX = 5 / 16
/** A groove may be at most half the thickness of the board it is cut into (to the 1/64" below). */
const halfOf = (t: number) => Math.floor((t / 2) * 64 + 1e-9) / 64
const END_INSET = 0.75

/** Two sides with dadoed top, bottom and shelves, and an optional back in rabbets. */
export const bookshelf: TemplateDef = {
  id: 'bookshelf',
  name: 'Bookshelf',
  params: [
    { key: 'W', label: 'Width (outside)', kind: 'inches', default: 30, min: 6, max: 96 },
    { key: 'H', label: 'Height', kind: 'inches', default: 36, min: 6, max: 96 },
    { key: 'D', label: 'Depth', kind: 'inches', default: 10, min: 3, max: 48 },
    { key: 'shelves', label: 'Shelves (between top and bottom)', kind: 'count', default: 3, min: 0, max: 12 },
    { key: 'wood', label: 'Wood', kind: 'wood', default: 'ply-3-4' },
    { key: 'back', label: 'Back panel', kind: 'bool', default: true },
    { key: 'backWood', label: 'Back wood', kind: 'wood', default: 'ply-1-4' }
  ],
  adjust(params, woods: Wood[]) {
    // Leave at least 1" between the sides, 1" between shelves, and 1" of shelf in front of the back.
    const t = woodOf(woods, params.wood as string).thickness
    const n = params.shelves as number
    const tb = params.back ? woodOf(woods, params.backWood as string).thickness : 0
    return {
      ...params,
      W: Math.max(params.W as number, 2 * t + 1),
      H: Math.max(params.H as number, 2 * END_INSET + (n + 2) * t + (n + 1)),
      D: Math.max(params.D as number, tb + 1)
    }
  },
  build(params, woods: Wood[]) {
    const W = params.W as number
    const H = params.H as number
    const D = params.D as number
    const n = params.shelves as number
    const wood = woodOf(woods, params.wood as string)
    const t = wood.thickness
    const hasBack = params.back as boolean
    const backWood = woodOf(woods, params.backWood as string)
    const tb = hasBack ? backWood.thickness : 0
    const DADO_DEPTH = Math.min(DADO_DEPTH_MAX, halfOf(t))
    const BACK_RABBET_DEPTH = Math.min(BACK_RABBET_DEPTH_MAX, halfOf(t))

    const left = makeBoard('Side', wood, D, H, ORIENT.uprightY, { x: 0, y: 0, z: 0 })
    const right = makeBoard('Side', wood, D, H, ORIENT.uprightY, { x: W - t, y: 0, z: 0 })

    const shelfLen = W - 2 * t + 2 * DADO_DEPTH
    const shelfDepth = D - tb
    const bottomZ = END_INSET
    const topZ = H - END_INSET - t
    const gap = (topZ - bottomZ - t - n * t) / (n + 1)
    // Shelf heights are mirror-symmetric (snapped from the bottom, mirrored for the upper half), so the two
    // sides are the same part turned end-for-end.
    const shelfZ = Array.from({ length: n }, (_, i) => snap64(bottomZ + t + (i + 1) * gap + i * t))
    for (let i = 0; i < n; i++) if (i > n - 1 - i) shelfZ[i] = H - t - shelfZ[n - 1 - i]
    const levels: { name: string; z: number }[] = [
      { name: 'Top', z: topZ },
      { name: 'Bottom', z: bottomZ },
      ...shelfZ.map(z => ({ name: 'Shelf', z }))
    ]
    const shelves = levels.map(l => makeBoard(l.name, wood, shelfDepth, shelfLen, ORIENT.flatX, { x: t - DADO_DEPTH, y: 0, z: l.z }))

    const boards: Board[] = [left, right, ...shelves]
    const joints: Joint[] = []
    shelves.forEach((s, i) => {
      for (const side of [left, right]) {
        joints.push(groove('dado', side, s, { width: t, depth: DADO_DEPTH, offset: levels[i].z, along: 'width' }))
      }
    })
    if (hasBack) {
      const backWidth = W - 2 * t + 2 * BACK_RABBET_DEPTH
      const back = makeBoard('Back', backWood, backWidth, H, ORIENT.uprightX, { x: t - BACK_RABBET_DEPTH, y: D - tb, z: 0 })
      boards.push(back)
      for (const side of [left, right]) {
        joints.push(groove('rabbet', side, back, { width: tb, depth: BACK_RABBET_DEPTH, offset: D - tb, along: 'length' }))
      }
    }
    return { boards, joints }
  }
}
