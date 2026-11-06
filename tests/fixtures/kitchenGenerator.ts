// Builds the "full kitchen" performance fixture from the app's own template, door and drawer code.
// To rewrite tests/fixtures/kitchen.aaw after changing this file or the cabinet code:
//   AA_WRITE_FIXTURE=1 npx vitest run tests/perf/kitchenFixture.test.ts
import { addDoors, DOOR_DEFAULTS, type DoorOptions } from '../../src/cabinet/doors'
import { addDrawer, DRAWER_DEFAULTS, type DrawerOptions } from '../../src/cabinet/drawers'
import { addAsGroup } from '../../src/cabinet/build'
import { addHardware } from '../../src/cabinet/hardware'
import { serialize } from '../../src/model/fileFormat'
import type { Board, Joint, Project } from '../../src/model/types'
import { emptyProject } from '../../src/model/woods'
import { applyTemplate } from '../../src/templates'

type Result<T> = T | { error: string }
function ok<T extends object>(r: Result<T>): T {
  if ('error' in r) throw new Error((r as { error: string }).error)
  return r
}

/** Ids and timestamps from a fixed sequence, so regenerating gives the same file. */
function deterministic<T>(fn: () => T): T {
  const { now } = Date
  const { random } = Math
  let seed = 12345
  Math.random = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296 }
  Date.now = () => 1_760_000_000_000
  try { return fn() } finally { Date.now = now; Math.random = random }
}

const door = (over: Partial<DoorOptions> = {}): DoorOptions => ({ ...DOOR_DEFAULTS, pull: 'pull-96', pullPlace: 'upper', ...over })
const drawer = (over: Partial<DrawerOptions> = {}): DrawerOptions => ({ ...DRAWER_DEFAULTS, ...over })

type Fill =
  | { kind: 'doors'; opts: Partial<DoorOptions>; /** Door zone: floor-relative bottom and height (whole front when absent). */ zone?: [number, number] }
  | { kind: 'drawers'; heights: number[]; opts?: Partial<DrawerOptions> }
  | { kind: 'none' }

type Cab = {
  name: string
  template: 'cabinet' | 'bookshelf'
  params: Record<string, number | boolean | string>
  /** Left edge, front, and floor height of the cabinet. */
  x: number; y: number; z: number
  fill: Fill[]
}

function addCabinet(p0: Project, c: Cab): Project {
  const t = applyTemplate(emptyProject('t'), c.template, c.params)
  const dx = c.x, dy = c.y, dz = c.z
  const move = (b: Board): Board => ({ ...b, position: { x: b.position.x + dx, y: b.position.y + dy, z: b.position.z + dz } })
  const boards = t.boards.map(move)
  const joints: Joint[] = t.joints
  const g = addAsGroup(p0, boards, joints, c.name)
  let p = g.project
  for (const h of t.hardware ?? []) p = addHardware(p, { itemId: h.itemId, qty: h.qty, note: h.note, groupId: g.id })
  const W = c.params.W as number, H = c.params.H as number, D = c.params.D as number
  const wood = p.woods.find(w => w.id === (c.params.wood ?? 'ply-3-4'))!
  const T = wood.thickness
  const toe = c.template === 'cabinet' ? (c.params.toe as number ?? 4) : 0
  // The opening inside the box (base cabinets keep the top rail and toe kick out of it).
  const inner = { x: dx + T, y: dy, z: dz + toe + T, width: W - 2 * T, height: H - toe - 2 * T, depth: D - 1.25 }
  // Doors lap the whole front, 1/16" in from each neighbour; drawers fill the inside.
  const front = { x: dx + 0.5625, y: dy, z: dz + toe + 0.5625, width: W - 1.125, height: H - toe - 1.125 }
  const groupBefore = new Set((p.groups ?? []).map(x => x.id))
  const nest = (ids: string[]) => {
    p = { ...p, groups: (p.groups ?? []).map(x => ids.includes(x.id) && !groupBefore.has(x.id) ? { ...x, parentId: g.id } : x) }
  }
  let z = inner.z
  const totalH = inner.height
  for (const f of c.fill) {
    if (f.kind === 'doors') {
      const zoned = f.zone ? { ...front, z: dz + f.zone[0] + 0.5625, height: f.zone[1] - 1.125 } : front
      const r = ok(addDoors(p, zoned, door(f.opts)))
      p = r.project; nest(r.groupIds)
    } else if (f.kind === 'drawers') {
      const sum = f.heights.reduce((a, b) => a + b, 0)
      let zz = inner.z + totalH - sum
      z = zz
      for (const h of f.heights) {
        const r = ok(addDrawer(p, { ...inner, z: zz + 0.5625, height: h - 1.125 }, drawer(f.opts)))
        p = r.project; nest([r.groupId])
        zz += h
      }
    }
  }
  return p
}

export function buildKitchen(): Project {
  return deterministic(() => {
    let p: Project = { ...emptyProject('Full kitchen'), units: 'in' }
    const base = (name: string, W: number, x: number, fill: Fill[], extra: Record<string, number | boolean | string> = {}): Cab =>
      ({ name, template: 'cabinet', params: { W, H: 34.5, D: 23.25, toe: 4, shelf: fill[0]?.kind === 'doors', ...extra }, x, y: 0, z: 0, fill })
    const wall = (name: string, W: number, x: number, fill: Fill[], shelves = 3, H = 30): Cab =>
      ({ name, template: 'bookshelf', params: { W, H, D: 12, shelves, back: true }, x, y: 0, z: 54, fill })
    const tall = (name: string, W: number, x: number, fill: Fill[]): Cab =>
      ({ name, template: 'bookshelf', params: { W, H: 84, D: 24, shelves: 4, back: true }, x, y: 0, z: 0, fill })

    const cabs: Cab[] = []
    // South run of base cabinets.
    let x = 0
    const add = (c: (x: number) => Cab, w: number) => { cabs.push(c(x)); x += w }
    add(x => base('Base 24 door', 24, x, [{ kind: 'doors', opts: {} }]), 24)
    add(x => base('Base 18 drawers', 18, x, [{ kind: 'drawers', heights: [5, 6, 6, 6], opts: { joinery: 'dado' } }]), 18)
    add(x => base('Base 36 sink', 36, x, [{ kind: 'doors', opts: { pair: true, style: 'raised', panelWood: 'ply-3-4' } }]), 36)
    add(x => base('Base 30 drawers', 30, x, [{ kind: 'drawers', heights: [6, 10, 10], opts: { joinery: 'rabbet' } }]), 30)
    add(x => base('Base 24 dovetail drawers', 24, x, [{ kind: 'drawers', heights: [5, 5, 5], opts: { joinery: 'dovetail' } }]), 24)
    add(x => base('Base 36 doors', 36, x, [{ kind: 'doors', opts: { pair: true } }]), 36)
    const runEnd = x
    // Wall cabinets above the run.
    x = 0
    for (const [name, w, fill] of [
      ['Wall 24', 24, { kind: 'doors', opts: { style: 'glass' } }],
      ['Wall 18', 18, { kind: 'doors', opts: { hinge: 'right' } }],
      ['Wall 36', 36, { kind: 'doors', opts: { pair: true } }],
      ['Wall 30', 30, { kind: 'doors', opts: { pair: true, style: 'raised', panelWood: 'ply-3-4' } }],
      ['Wall 24 b', 24, { kind: 'doors', opts: { style: 'glass' } }]
    ] as [string, number, Fill][]) {
      cabs.push(wall(name, w, x, [fill]))
      x += w
    }
    // Tall cabinets (pantry, oven tower) at the end of the run.
    x = runEnd + 1
    for (const [name, w] of [['Pantry', 24], ['Oven tower', 30]] as [string, number][]) {
      const lower: Fill = { kind: 'doors', opts: { pair: w >= 30 }, zone: [4, 40] }
      const upper: Fill = { kind: 'doors', opts: { pair: w >= 30, style: 'raised', panelWood: 'ply-3-4' }, zone: [44, 40] }
      cabs.push(tall(name, w, x, [lower, upper]))
      x += w
    }
    // An island facing the run: three drawer banks.
    let ix = 24
    for (const [name, w, heights, joinery] of [['Island 30', 30, [5, 6.5, 6.5, 6.5], 'rabbet'], ['Island 36', 36, [5, 6.5, 6.5, 6.5], 'dado'], ['Island 24', 24, [6, 8, 8], 'rabbet']] as [string, number, number[], DrawerOptions['joinery']][]) {
      cabs.push(base(name, w, ix, [{ kind: 'drawers', heights, opts: { joinery } }]))
      cabs[cabs.length - 1].y = 66
      ix += w
    }
    for (const c of cabs) p = addCabinet(p, c)
    return p
  })
}

export const kitchenText = (): string => serialize(buildKitchen())
