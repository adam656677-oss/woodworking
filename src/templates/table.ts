import type { Board, Joint, Wood } from '../model/types'
import { num, woodT, type TemplateDef, type UnlockForm } from './index'
import { butt, glued, makeBoard, ORIENT, woodOf } from './place'

const SCREWS = { fastener: 'screws' as const, count: 2 }

/**
 * A side or end table: four square legs, an apron between each pair (set back a little from the leg faces) and a
 * top glued up from boards edge to edge, overhanging the legs. Tabletop fasteners (not glue) hold the top so it
 * can move with the seasons.
 */
export const table: TemplateDef = {
  id: 'table',
  name: 'Side table',
  params: [
    { key: 'W', label: 'Top width', kind: 'inches', default: 22, min: 10, max: 72 },
    { key: 'D', label: 'Top depth', kind: 'inches', default: 18, min: 10, max: 40 },
    { key: 'H', label: 'Height', kind: 'inches', default: 24, min: 12, max: 36 },
    { key: 'over', label: 'Top overhang', kind: 'inches', default: 1, min: 0, max: 4 },
    { key: 'apron', label: 'Apron height', kind: 'inches', default: 3.5, min: 2, max: 6 },
    { key: 'legWood', label: 'Leg wood', kind: 'wood', default: 'hw-8-4' },
    { key: 'wood', label: 'Apron and top wood', kind: 'wood', default: 'hw-4-4' },
    { key: 'boards', label: 'Boards in the top', kind: 'count', default: 3, min: 1, max: 8 }
  ],
  adjust(params, woods: Wood[]) {
    // The legs and aprons have to fit under the top; the top boards no wider than the stock.
    const L = woodOf(woods, params.legWood as string).thickness
    const w = woodOf(woods, params.wood as string)
    const o = params.over as number
    const minSide = 2 * L + 2 + 2 * o
    const D = Math.max(params.D as number, minSide), W = Math.max(params.W as number, minSide)
    const n = Math.max(params.boards as number, Math.ceil(D / w.width - 1e-9))
    return { ...params, W, D, boards: n, H: Math.max(params.H as number, (params.apron as number) + w.thickness + 4) }
  },
  unlockForm(params): UnlockForm {
    const n = params.boards as number
    const sizes = [
      { name: 'W', expr: num(params.W as number) }, { name: 'D', expr: num(params.D as number) }, { name: 'H', expr: num(params.H as number) },
      { name: 'Over', expr: num(params.over as number) }, { name: 'Apron', expr: num(params.apron as number) },
      { name: 'L', expr: woodT(params.legWood as string) }, { name: 'T', expr: woodT(params.wood as string) },
      { name: 'Inset', expr: '1/4' }, { name: 'Boards', expr: String(n) },
      { name: 'LegH', expr: 'H - T' }, { name: 'BaseW', expr: 'W - 2*Over' }, { name: 'BaseD', expr: 'D - 2*Over' }
    ]
    const legs: Record<number, Record<string, string>> = {
      0: { width: '=L', length: '=LegH', z: '=0' },
      1: { width: '=L', length: '=LegH', x: '=BaseW - L' },
      2: { width: '=L', length: '=LegH', y: '=BaseD - L' },
      3: { width: '=L', length: '=LegH', x: '=BaseW - L', y: '=BaseD - L' }
    }
    const top = 'LegH - Apron'
    const aprons: Record<number, Record<string, string>> = {
      4: { width: '=Apron', length: '=BaseW - 2*L', x: '=L', y: '=Inset', z: `=${top}` },
      5: { width: '=Apron', length: '=BaseW - 2*L', x: '=L', y: '=BaseD - Inset - T', z: `=${top}` },
      6: { width: '=Apron', length: '=BaseD - 2*L', x: '=Inset', y: '=L', z: `=${top}` },
      7: { width: '=Apron', length: '=BaseD - 2*L', x: '=BaseW - Inset - T', y: '=L', z: `=${top}` }
    }
    const tops: Record<number, Record<string, string>> = {}
    for (let k = 0; k < n; k++) tops[8 + k] = { width: '=D/Boards', length: '=W', x: '=-Over', y: `=-Over + ${k}*D/Boards`, z: '=LegH' }
    return { sizes, boards: { ...legs, ...aprons, ...tops } }
  },
  build(params, woods: Wood[]) {
    const W = params.W as number, D = params.D as number, H = params.H as number, o = params.over as number, A = params.apron as number
    const legW = woodOf(woods, params.legWood as string)
    const w = woodOf(woods, params.wood as string)
    const L = legW.thickness, T = w.thickness, inset = 0.25
    const n = params.boards as number
    const legH = H - T
    const bw = W - 2 * o, bd = D - 2 * o
    const leg = (name: string, x: number, y: number) => makeBoard(name, legW, L, legH, ORIENT.uprightX, { x, y, z: 0 })
    const legs = [leg('Leg', 0, 0), leg('Leg', bw - L, 0), leg('Leg', 0, bd - L), leg('Leg', bw - L, bd - L)]
    const z = legH - A
    const front = makeBoard('Long apron', w, A, bw - 2 * L, ORIENT.wallX, { x: L, y: inset, z })
    const back = makeBoard('Long apron', w, A, bw - 2 * L, ORIENT.wallX, { x: L, y: bd - inset - T, z })
    const left = makeBoard('Short apron', w, A, bd - 2 * L, ORIENT.wallY, { x: inset, y: L, z })
    const right = makeBoard('Short apron', w, A, bd - 2 * L, ORIENT.wallY, { x: bw - inset - T, y: L, z })
    const tops: Board[] = []
    for (let k = 0; k < n; k++) tops.push(makeBoard('Top board', w, Math.floor((D / n) * 64) / 64, W, ORIENT.flatX, { x: -o, y: -o + (k * D) / n, z: legH }))
    const joints: Joint[] = [
      butt(legs[0], front, SCREWS), butt(legs[1], front, SCREWS), butt(legs[2], back, SCREWS), butt(legs[3], back, SCREWS),
      butt(legs[0], left, SCREWS), butt(legs[2], left, SCREWS), butt(legs[1], right, SCREWS), butt(legs[3], right, SCREWS)
    ]
    const all = [...legs, front, back, left, right, ...tops]
    // The top is glued up edge to edge.
    for (let k = 1; k < n; k++) { const g = glued(all, woods, tops[k - 1], tops[k]); if (g) joints.push(g) }
    return { boards: all, joints }
  }
}
