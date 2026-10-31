// More Master Shop templates: workbench, base cabinet, cutting board, step stool and wall shelf.
// Each builds its parts from a few sizes and writes the same thing as formulas for Unlock.
import type { Board, Joint, Wood } from '../model/types'
import { num, woodT, type TemplateDef, type UnlockForm } from './index'
import { butt, glued, makeBoard, ORIENT, woodOf } from './place'

const SCREWS = { fastener: 'screws' as const, count: 2 }
const s = (n: number) => num(n)

/** A sturdy shop bench: 2×4 legs and rails, a plywood top with overhang, an optional lower shelf. */
export const workbench: TemplateDef = {
  id: 'workbench',
  name: 'Workbench',
  params: [
    { key: 'W', label: 'Top width', kind: 'inches', default: 60, min: 24, max: 96 },
    { key: 'D', label: 'Top depth', kind: 'inches', default: 24, min: 16, max: 48 },
    { key: 'H', label: 'Height', kind: 'inches', default: 34, min: 24, max: 42 },
    { key: 'over', label: 'Top overhang', kind: 'inches', default: 2, min: 0, max: 6 },
    { key: 'frame', label: 'Frame lumber', kind: 'wood', default: '2x4' },
    { key: 'top', label: 'Top', kind: 'wood', default: 'ply-3-4' },
    { key: 'shelf', label: 'Lower shelf', kind: 'bool', default: true }
  ],
  unlockForm(params): UnlockForm {
    const shelf = !!params.shelf
    const sizes = [
      { name: 'W', expr: s(params.W as number) }, { name: 'D', expr: s(params.D as number) }, { name: 'H', expr: s(params.H as number) },
      { name: 'Over', expr: s(params.over as number) }, { name: 'F', expr: woodT(params.frame as string) }, { name: 'FW', expr: s(3.5) },
      { name: 'T', expr: woodT(params.top as string) }, { name: 'ST', expr: woodT(params.top as string) },
      { name: 'BW', expr: 'W - 2*Over' }, { name: 'BD', expr: 'D - 2*Over' }, { name: 'LegH', expr: 'H - T' }, { name: 'Low', expr: '6' }
    ]
    const leg = (x: string, y: string) => ({ width: '=FW', length: '=LegH', x, y, z: '=0' })
    const boards: Record<number, Record<string, string>> = {
      0: leg('=0', '=0'), 1: leg('=BW - FW', '=0'), 2: leg('=0', '=BD - F'), 3: leg('=BW - FW', '=BD - F'),
      4: { width: '=FW', length: '=BW - 2*FW', x: '=FW', y: '=0', z: '=LegH - FW' },
      5: { width: '=FW', length: '=BW - 2*FW', x: '=FW', y: '=BD - F', z: '=LegH - FW' },
      6: { width: '=FW', length: '=BD - 2*F', x: '=1', y: '=F', z: '=LegH - FW' },
      7: { width: '=FW', length: '=BD - 2*F', x: '=BW - 1 - F', y: '=F', z: '=LegH - FW' },
      8: { width: '=D', length: '=W', x: '=-Over', y: '=-Over', z: '=LegH' }
    }
    if (shelf) {
      Object.assign(boards, {
        9: { width: '=FW', length: '=BW - 2*FW', x: '=FW', y: '=0', z: '=Low' },
        10: { width: '=FW', length: '=BW - 2*FW', x: '=FW', y: '=BD - F', z: '=Low' },
        11: { width: '=BD', length: '=BW - 2*FW', x: '=FW', y: '=0', z: '=Low + FW' }
      })
    }
    return { sizes, boards }
  },
  build(params, woods: Wood[]) {
    const W = params.W as number, D = params.D as number, H = params.H as number, o = params.over as number
    const f = woodOf(woods, params.frame as string), top = woodOf(woods, params.top as string)
    const F = f.thickness, FW = 3.5, T = top.thickness
    const bw = W - 2 * o, bd = D - 2 * o, legH = H - T
    const leg = (x: number, y: number) => makeBoard('Leg', f, FW, legH, ORIENT.uprightX, { x, y, z: 0 })
    const legs = [leg(0, 0), leg(bw - FW, 0), leg(0, bd - F), leg(bw - FW, bd - F)]
    const zr = legH - FW
    const front = makeBoard('Long rail', f, FW, bw - 2 * FW, ORIENT.wallX, { x: FW, y: 0, z: zr })
    const back = makeBoard('Long rail', f, FW, bw - 2 * FW, ORIENT.wallX, { x: FW, y: bd - F, z: zr })
    const left = makeBoard('Short rail', f, FW, bd - 2 * F, ORIENT.wallY, { x: 1, y: F, z: zr })
    const right = makeBoard('Short rail', f, FW, bd - 2 * F, ORIENT.wallY, { x: bw - 1 - F, y: F, z: zr })
    const tp = makeBoard('Top', top, D, W, ORIENT.flatX, { x: -o, y: -o, z: legH })
    const boards: Board[] = [...legs, front, back, left, right, tp]
    const joints: Joint[] = [
      butt(legs[0], front, SCREWS), butt(legs[1], front, SCREWS), butt(legs[2], back, SCREWS), butt(legs[3], back, SCREWS),
      butt(legs[0], left, SCREWS), butt(legs[2], left, SCREWS), butt(legs[1], right, SCREWS), butt(legs[3], right, SCREWS)
    ]
    for (const r of [front, back, left, right]) joints.push(butt(tp, r, SCREWS))
    if (params.shelf) {
      const lf = makeBoard('Shelf rail', f, FW, bw - 2 * FW, ORIENT.wallX, { x: FW, y: 0, z: 6 })
      const lb = makeBoard('Shelf rail', f, FW, bw - 2 * FW, ORIENT.wallX, { x: FW, y: bd - F, z: 6 })
      const sh = makeBoard('Shelf', top, bd, bw - 2 * FW, ORIENT.flatX, { x: FW, y: 0, z: 6 + FW })
      boards.push(lf, lb, sh)
      joints.push(butt(legs[0], lf, SCREWS), butt(legs[1], lf, SCREWS), butt(legs[2], lb, SCREWS), butt(legs[3], lb, SCREWS), butt(sh, lf, SCREWS), butt(sh, lb, SCREWS))
    }
    return { boards, joints }
  }
}

/** A frameless base cabinet box: sides to the floor, bottom above a set-back toe kick, top stretchers, a back and an optional shelf. */
export const cabinet: TemplateDef = {
  id: 'cabinet',
  name: 'Base cabinet',
  params: [
    { key: 'W', label: 'Width', kind: 'inches', default: 24, min: 9, max: 48 },
    { key: 'H', label: 'Height', kind: 'inches', default: 34.5, min: 12, max: 40 },
    { key: 'D', label: 'Depth (box)', kind: 'inches', default: 23.25, min: 10, max: 30 },
    { key: 'toe', label: 'Toe kick height', kind: 'inches', default: 4, min: 2, max: 6 },
    { key: 'wood', label: 'Box wood', kind: 'wood', default: 'ply-3-4' },
    { key: 'back', label: 'Back wood', kind: 'wood', default: 'ply-1-4' },
    { key: 'shelf', label: 'Shelf', kind: 'bool', default: true }
  ],
  unlockForm(params): UnlockForm {
    const sizes = [
      { name: 'W', expr: s(params.W as number) }, { name: 'H', expr: s(params.H as number) }, { name: 'D', expr: s(params.D as number) },
      { name: 'Toe', expr: s(params.toe as number) }, { name: 'T', expr: woodT(params.wood as string) }, { name: 'BT', expr: woodT(params.back as string) },
      { name: 'Kick', expr: '3' }, { name: 'Rail', expr: '3-1/2' }, { name: 'Inside', expr: 'W - 2*T' }
    ]
    const boards: Record<number, Record<string, string>> = {
      0: { width: '=D', length: '=H', x: '=0', y: '=0', z: '=0' },
      1: { width: '=D', length: '=H', x: '=W - T', y: '=0', z: '=0' },
      2: { width: '=D', length: '=Inside', x: '=T', y: '=0', z: '=Toe' },
      3: { width: '=Toe', length: '=Inside', x: '=T', y: '=Kick', z: '=0' },
      4: { width: '=Rail', length: '=Inside', x: '=T', y: '=0', z: '=H - T' },
      5: { width: '=Rail', length: '=Inside', x: '=T', y: '=D - Rail', z: '=H - T' },
      6: { width: '=W', length: '=H - Toe', x: '=0', y: '=D', z: '=Toe' }
    }
    if (params.shelf) boards[7] = { width: '=D - 1', length: '=Inside', x: '=T', y: '=0', z: '=Toe + (H - Toe)/2' }
    return { sizes, boards }
  },
  build(params, woods: Wood[]) {
    const W = params.W as number, H = params.H as number, D = params.D as number, toe = params.toe as number
    const w = woodOf(woods, params.wood as string), bk = woodOf(woods, params.back as string)
    const T = w.thickness, inside = W - 2 * T
    const left = makeBoard('Side', w, D, H, ORIENT.uprightY, { x: 0, y: 0, z: 0 })
    const right = makeBoard('Side', w, D, H, ORIENT.uprightY, { x: W - T, y: 0, z: 0 })
    const bottom = makeBoard('Bottom', w, D, inside, ORIENT.flatX, { x: T, y: 0, z: toe })
    const kick = makeBoard('Toe kick', w, toe, inside, ORIENT.wallX, { x: T, y: 3, z: 0 })
    const front = makeBoard('Top rail', w, 3.5, inside, ORIENT.flatX, { x: T, y: 0, z: H - T })
    const backRail = makeBoard('Top rail', w, 3.5, inside, ORIENT.flatX, { x: T, y: D - 3.5, z: H - T })
    const back = makeBoard('Back', bk, W, H - toe, ORIENT.uprightX, { x: 0, y: D, z: toe })
    const boards: Board[] = [left, right, bottom, kick, front, backRail, back]
    const joints: Joint[] = []
    for (const side of [left, right]) for (const p of [bottom, kick, front, backRail]) joints.push(butt(side, p, SCREWS))
    joints.push(butt(bottom, kick, SCREWS), butt(back, left, SCREWS), butt(back, right, SCREWS))
    if (params.shelf) {
      // An adjustable shelf on pins, set back 1" so the doors clear it; pins hold it, so no joint is drawn.
      const sh = makeBoard('Shelf', w, D - 1, inside, ORIENT.flatX, { x: T, y: 0, z: toe + (H - toe) / 2 })
      boards.push(sh)
      joints.push(butt(left, sh, { fastener: 'glue', count: 0 }), butt(right, sh, { fastener: 'glue', count: 0 }))
    }
    return { boards, joints }
  }
}

/** A glued-up cutting board: strips laid flat, edge to edge; every other strip can be a second wood. */
export const cuttingBoard: TemplateDef = {
  id: 'cuttingBoard',
  name: 'Cutting board',
  params: [
    { key: 'L', label: 'Length', kind: 'inches', default: 16, min: 6, max: 30 },
    { key: 'strip', label: 'Strip width', kind: 'inches', default: 1.75, min: 0.75, max: 4 },
    { key: 'n', label: 'Strips', kind: 'count', default: 6, min: 2, max: 16 },
    { key: 'wood', label: 'Wood', kind: 'wood', default: 'hw-4-4' },
    { key: 'wood2', label: 'Every other strip', kind: 'wood', default: 'hw-4-4' }
  ],
  adjust(params, woods: Wood[]) {
    // Both woods the same thickness, or the board isn't flat: use the first wood's when they differ.
    const a = woodOf(woods, params.wood as string), b = woodOf(woods, params.wood2 as string)
    return a.thickness === b.thickness ? params : { ...params, wood2: params.wood }
  },
  unlockForm(params): UnlockForm {
    const n = params.n as number
    const boards: Record<number, Record<string, string>> = {}
    for (let k = 0; k < n; k++) boards[k] = { width: '=Strip', length: '=L', x: '=0', y: `=${k}*Strip`, z: '=0' }
    return { sizes: [{ name: 'L', expr: s(params.L as number) }, { name: 'Strip', expr: s(params.strip as number) }, { name: 'T', expr: woodT(params.wood as string) }], boards }
  },
  build(params, woods: Wood[]) {
    const L = params.L as number, sw = params.strip as number, n = params.n as number
    const a = woodOf(woods, params.wood as string), b = woodOf(woods, params.wood2 as string)
    const boards: Board[] = []
    for (let k = 0; k < n; k++) boards.push(makeBoard('Strip', k % 2 ? b : a, sw, L, ORIENT.flatX, { x: 0, y: k * sw, z: 0 }))
    const joints: Joint[] = []
    for (let k = 1; k < n; k++) { const g = glued(boards, woods, boards[k - 1], boards[k]); if (g) joints.push(g) }
    return { boards, joints }
  }
}

/** A two-step stool: sides, a top, a lower step and a back stretcher. */
export const stepStool: TemplateDef = {
  id: 'stepStool',
  name: 'Step stool',
  params: [
    { key: 'W', label: 'Width', kind: 'inches', default: 16, min: 10, max: 24 },
    { key: 'H', label: 'Height', kind: 'inches', default: 16, min: 8, max: 24 },
    { key: 'wood', label: 'Sides and top', kind: 'wood', default: '1x10' },
    { key: 'step', label: 'Lower step', kind: 'wood', default: '1x6' },
    { key: 'rail', label: 'Back stretcher', kind: 'wood', default: '1x4' }
  ],
  unlockForm(params, woods: Wood[]): UnlockForm {
    const w = woodOf(woods, params.wood as string), st = woodOf(woods, params.step as string), r = woodOf(woods, params.rail as string)
    return {
      sizes: [
        { name: 'W', expr: s(params.W as number) }, { name: 'H', expr: s(params.H as number) }, { name: 'T', expr: woodT(params.wood as string) },
        { name: 'Deep', expr: s(w.width) }, { name: 'StepW', expr: s(st.width) }, { name: 'RailW', expr: s(r.width) }
      ],
      boards: {
        0: { width: '=Deep', length: '=H - T', x: '=0', y: '=0', z: '=0' },
        1: { width: '=Deep', length: '=H - T', x: '=W - T', y: '=0', z: '=0' },
        2: { width: '=Deep', length: '=W', x: '=0', y: '=0', z: '=H - T' },
        3: { width: '=StepW', length: '=W - 2*T', x: '=T', y: '=0', z: '=(H - T)/2' },
        4: { width: '=RailW', length: '=W - 2*T', x: '=T', y: `=Deep - ${s(r.thickness)}`, z: '=H - T - RailW' }
      }
    }
  },
  build(params, woods: Wood[]) {
    const W = params.W as number, H = params.H as number
    const w = woodOf(woods, params.wood as string), st = woodOf(woods, params.step as string), r = woodOf(woods, params.rail as string)
    const T = w.thickness, deep = w.width
    const left = makeBoard('Side', w, deep, H - T, ORIENT.uprightY, { x: 0, y: 0, z: 0 })
    const right = makeBoard('Side', w, deep, H - T, ORIENT.uprightY, { x: W - T, y: 0, z: 0 })
    const top = makeBoard('Top', w, deep, W, ORIENT.flatX, { x: 0, y: 0, z: H - T })
    const step = makeBoard('Step', st, st.width, W - 2 * T, ORIENT.flatX, { x: T, y: 0, z: (H - T) / 2 })
    const rail = makeBoard('Stretcher', r, r.width, W - 2 * T, ORIENT.wallX, { x: T, y: deep - r.thickness, z: H - T - r.width })
    return {
      boards: [left, right, top, step, rail],
      joints: [butt(top, left, SCREWS), butt(top, right, SCREWS), butt(left, step, SCREWS), butt(right, step, SCREWS), butt(left, rail, SCREWS), butt(right, rail, SCREWS), butt(top, rail, SCREWS)]
    }
  }
}

/** A small wall shelf: two sides, evenly spaced shelves and a hanging rail under the top shelf to screw to the wall. */
export const wallShelf: TemplateDef = {
  id: 'wallShelf',
  name: 'Wall shelf',
  params: [
    { key: 'W', label: 'Width', kind: 'inches', default: 24, min: 8, max: 48 },
    { key: 'H', label: 'Height', kind: 'inches', default: 24, min: 8, max: 48 },
    { key: 'n', label: 'Shelves', kind: 'count', default: 3, min: 2, max: 6 },
    { key: 'wood', label: 'Wood', kind: 'wood', default: '1x6' },
    { key: 'rail', label: 'Hanging rail', kind: 'wood', default: '1x3' }
  ],
  adjust(params) {
    // Room between shelves for the rail under the top one.
    const n = params.n as number
    return { ...params, H: Math.max(params.H as number, (n - 1) * 4 + 1) }
  },
  unlockForm(params, woods: Wood[]): UnlockForm {
    const n = params.n as number
    const w = woodOf(woods, params.wood as string), r = woodOf(woods, params.rail as string)
    const boards: Record<number, Record<string, string>> = {
      0: { width: '=Deep', length: '=H', x: '=0', y: '=0', z: '=0' },
      1: { width: '=Deep', length: '=H', x: '=W - T', y: '=0', z: '=0' }
    }
    for (let k = 0; k < n; k++) boards[2 + k] = { width: '=Deep', length: '=W - 2*T', x: '=T', y: '=0', z: `=${k}*(H - T)/${n - 1}` }
    boards[2 + n] = { width: '=RailW', length: '=W - 2*T', x: '=T', y: '=Deep - RT', z: '=H - T - RailW' }
    return {
      sizes: [
        { name: 'W', expr: s(params.W as number) }, { name: 'H', expr: s(params.H as number) }, { name: 'T', expr: woodT(params.wood as string) },
        { name: 'Deep', expr: s(w.width) }, { name: 'RT', expr: woodT(params.rail as string) }, { name: 'RailW', expr: s(r.width) }
      ],
      boards
    }
  },
  build(params, woods: Wood[]) {
    const W = params.W as number, H = params.H as number, n = params.n as number
    const w = woodOf(woods, params.wood as string), r = woodOf(woods, params.rail as string)
    const T = w.thickness, deep = w.width
    const left = makeBoard('Side', w, deep, H, ORIENT.uprightY, { x: 0, y: 0, z: 0 })
    const right = makeBoard('Side', w, deep, H, ORIENT.uprightY, { x: W - T, y: 0, z: 0 })
    const shelves = Array.from({ length: n }, (_, k) => makeBoard('Shelf', w, deep, W - 2 * T, ORIENT.flatX, { x: T, y: 0, z: (k * (H - T)) / (n - 1) }))
    const rail = makeBoard('Hanging rail', r, r.width, W - 2 * T, ORIENT.wallX, { x: T, y: deep - r.thickness, z: H - T - r.width })
    const joints: Joint[] = []
    for (const sh of shelves) joints.push(butt(left, sh, SCREWS), butt(right, sh, SCREWS))
    joints.push(butt(left, rail, SCREWS), butt(right, rail, SCREWS), butt(shelves[n - 1], rail, SCREWS))
    return { boards: [left, right, ...shelves, rail], joints }
  }
}
