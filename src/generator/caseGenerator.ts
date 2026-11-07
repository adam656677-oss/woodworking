// The case generator: a bookcase, base cabinet or wall cabinet built from a few sizes and a construction style,
// previewed on its own and then added to the current design as one group (it never replaces the design).
import { addAsGroup, nextName } from '../cabinet/build'
import { addShelfPins, PIN_DEFAULTS } from '../cabinet/shelfPins'
import { contactBetween, jointOffers } from '../model/contact'
import { faceToward, worldBox } from '../model/geometry'
import { newId } from '../model/ids'
import type { Board, HardwareUse, Joint, Project, Wood } from '../model/types'
import { formatInches, snap64 } from '../model/units'
import { validate } from '../model/validate'
import { libraryAdvice } from '../library/advice'
import { sag, stiffnessOf } from '../library/calc'
import { emptyProject } from '../model/woods'
import { butt, groove, makeBoard, ORIENT } from '../templates/place'

export type CaseKind = 'bookcase' | 'base' | 'wall'
/** How the case is held together. */
export type Construction = 'dado' | 'rabbet' | 'screws' | 'pocket'

export type CaseSpec = {
  kind: CaseKind
  /** Outside width, height (floor to top, toe kick included) and depth (back included). */
  W: number; H: number; D: number
  wood: string
  /** The back's wood, or null for an open back. */
  back: string | null
  shelves: number
  shelfMode: 'fixed' | 'adjustable'
  construction: Construction
  /** Toe kick height (base cabinets only). */
  toe: number
}

export const KIND_LABELS: Record<CaseKind, string> = { bookcase: 'Bookcase', base: 'Base cabinet', wall: 'Wall cabinet' }
export const CONSTRUCTION_LABELS: Record<Construction, string> = {
  dado: 'Dados (top, bottom and shelves let into the sides)',
  rabbet: 'Rabbets at the ends, dados for shelves',
  screws: 'Butt joints with screws',
  pocket: 'Pocket screws'
}

export const CASE_DEFAULTS: Record<CaseKind, CaseSpec> = {
  bookcase: { kind: 'bookcase', W: 30, H: 36, D: 11.25, wood: 'ply-3-4', back: 'ply-1-4', shelves: 2, shelfMode: 'adjustable', construction: 'dado', toe: 0 },
  base: { kind: 'base', W: 24, H: 34.5, D: 24, wood: 'ply-3-4', back: 'ply-1-4', shelves: 1, shelfMode: 'adjustable', construction: 'screws', toe: 4 },
  wall: { kind: 'wall', W: 30, H: 30, D: 12, wood: 'ply-3-4', back: 'ply-1-4', shelves: 2, shelfMode: 'adjustable', construction: 'dado', toe: 0 }
}

/** The limits each size must stay inside. */
export const LIMITS = { W: [8, 96], H: [8, 96], D: [4, 30], shelves: [0, 12], toe: [2, 6] } as const

export type CasePlan = {
  boards: Board[]
  joints: Joint[]
  hardware: Omit<HardwareUse, 'id'>[]
  /** Fixed and adjustable shelves get pin holes after placing (the pins need the sides' final faces). */
  pinShelves: number
  /** Plain-language notes on clearances and how it goes together. */
  notes: string[]
}

const halfOf = (t: number) => Math.floor((t / 2) * 64 + 1e-9) / 64
const DADO_MAX = 0.25
const BACK_RABBET_MAX = 5 / 16
const END_INSET = 0.75
const RAIL = 3.5
const KICK_SETBACK = 3
const SCREWS_PER_JOINT = 3
const SHELF_SIDE_GAP = 1 / 16
const SHELF_SETBACK = 0.25
const MIN_GAP = 4

const woodIn = (woods: Wood[], id: string) => woods.find(w => w.id === id)

/** Builds the parts and joints for a case at the origin (front-left-bottom corner at 0, 0, 0). */
export function planCase(spec: CaseSpec, woods: Wood[]): CasePlan | { error: string } {
  const { kind, W, H, D, construction } = spec
  const wood = woodIn(woods, spec.wood)
  if (!wood) return { error: 'Choose the wood for the case' }
  if (wood.kind !== 'sheet' && wood.kind !== 'lumber' && wood.kind !== 'hardwood') return { error: `${wood.name} can't be used for a case` }
  const backWood = spec.back ? woodIn(woods, spec.back) : null
  if (spec.back && !backWood) return { error: 'Choose the wood for the back' }
  for (const k of ['W', 'H', 'D'] as const) {
    const [lo, hi] = LIMITS[k]
    if (!(spec[k] >= lo && spec[k] <= hi)) return { error: `${k === 'W' ? 'Width' : k === 'H' ? 'Height' : 'Depth'} must be between ${lo}" and ${hi}"` }
  }
  const n = Math.round(spec.shelves)
  if (!(n >= LIMITS.shelves[0] && n <= LIMITS.shelves[1])) return { error: `Shelves must be between 0 and ${LIMITS.shelves[1]}` }
  const toe = kind === 'base' ? spec.toe : 0
  if (kind === 'base' && !(toe >= LIMITS.toe[0] && toe <= LIMITS.toe[1])) return { error: `The toe kick must be between ${LIMITS.toe[0]}" and ${LIMITS.toe[1]}"` }

  const t = wood.thickness
  const tb = backWood?.thickness ?? 0
  const notes: string[] = []
  const inside = W - 2 * t
  if (inside < 2) return { error: `The case is too narrow for ${formatInches(t)} sides` }
  const boxH = H - toe
  // Grooved styles let the back into rabbets in the sides; screwed styles put it on the back edges.
  const grooved = construction === 'dado' || construction === 'rabbet'
  const backRabbet = Math.min(BACK_RABBET_MAX, halfOf(t))
  const sideDepth = backWood && !grooved ? D - tb : D
  const partDepth = D - tb
  if (partDepth < 3) return { error: 'The case is too shallow for its back' }
  const dado = Math.min(DADO_MAX, halfOf(t))
  const endRabbet = halfOf(t)

  const left = makeBoard('Side', wood, sideDepth, boxH, ORIENT.uprightY, { x: 0, y: 0, z: toe })
  const right = makeBoard('Side', wood, sideDepth, boxH, ORIENT.uprightY, { x: W - t, y: 0, z: toe })
  const boards: Board[] = [left, right]
  const joints: Joint[] = []
  const hardware: Omit<HardwareUse, 'id'>[] = []
  let screws = 0, pockets = 0

  /** A part spanning between the sides, joined the way the construction (or `how`) says. */
  const between = (name: string, z: number, how: 'dado' | 'rabbet' | 'screws' | 'pocket', width = partDepth, y = 0) => {
    const into = how === 'dado' ? dado : how === 'rabbet' ? endRabbet : 0
    const b = makeBoard(name, wood, width, inside + 2 * into, ORIENT.flatX, { x: t - into, y, z })
    boards.push(b)
    for (const side of [left, right]) {
      if (how === 'dado' || how === 'rabbet') joints.push(groove(how === 'dado' ? 'dado' : 'rabbet', side, b, { width: t, depth: into, offset: z - toe, along: 'width' }))
      else if (how === 'screws') { joints.push(butt(side, b, { fastener: 'screws', count: SCREWS_PER_JOINT })); screws += SCREWS_PER_JOINT }
      else { const count = width >= 6 ? 3 : 2; joints.push({ id: newId('j'), type: 'pocketScrew', hostBoardId: b.id, partnerBoardId: side.id, params: { count, spacing: snap64(Math.max(0.75, width - 1.5) / (count - 1)), screwLength: 1.25 } }); pockets += count }
    }
    return b
  }

  // Top and bottom (a base cabinet gets two top rails instead: the counter goes on them).
  const ends: 'dado' | 'rabbet' | 'screws' | 'pocket' = construction
  const inset = construction === 'dado' ? END_INSET : 0
  const bottomEnd = kind === 'base' && construction === 'dado' ? 'rabbet' : ends
  const bottomZ = toe + (bottomEnd === 'dado' ? inset : 0)
  const bottom = between('Bottom', bottomZ, bottomEnd)
  let topUnderside: number
  if (kind === 'base') {
    const railHow = construction === 'pocket' ? 'pocket' : 'screws'
    between('Top rail', H - t, railHow, RAIL, 0)
    between('Top rail', H - t, railHow, RAIL, partDepth - RAIL)
    topUnderside = H - t
    notes.push('The base cabinet has two top rails instead of a top; the countertop screws up through them.')
  } else {
    const topZ = H - t - inset
    between('Top', topZ, ends)
    topUnderside = topZ
  }
  if (construction === 'dado') notes.push(`Top and bottom sit ${formatInches(END_INSET)} in from the ends, in ${formatInches(dado)} deep dados.`)
  if (construction === 'rabbet') notes.push(`Top and bottom sit in ${formatInches(endRabbet)} deep rabbets at the ends of the sides.`)

  // Shelves, evenly spaced in the clear opening.
  const openBottom = bottomZ + t
  const fixed = spec.shelfMode === 'fixed'
  const gap = (topUnderside - openBottom - n * t) / (n + 1)
  if (n > 0 && gap < MIN_GAP) return { error: `${n} shelves leave only ${formatInches(Math.max(0, snap64(gap)))} between them; use fewer shelves or a taller case` }
  const shelfZ = Array.from({ length: n }, (_, i) => snap64(openBottom + (i + 1) * gap + i * t))
  if (fixed) {
    const how = construction === 'screws' ? 'screws' : construction === 'pocket' ? 'pocket' : 'dado'
    for (const z of shelfZ) between('Shelf', z, how)
    if (n) notes.push(`${n} fixed ${n > 1 ? 'shelves' : 'shelf'}, about ${formatInches(snap64(gap))} apart.`)
  } else if (n) {
    const shelfLen = inside - SHELF_SIDE_GAP
    for (const z of shelfZ) boards.push(makeBoard('Shelf', wood, partDepth - 2 * SHELF_SETBACK, shelfLen, ORIENT.flatX, { x: t + SHELF_SIDE_GAP / 2, y: SHELF_SETBACK, z }))
    notes.push(`Adjustable shelves are ${formatInches(SHELF_SIDE_GAP)} shorter than the inside width and ${formatInches(SHELF_SETBACK)} back from the front, so they drop in and move freely.`)
  }

  // Back.
  if (backWood) {
    if (grooved) {
      const back = makeBoard('Back', backWood, inside + 2 * backRabbet, boxH, ORIENT.uprightX, { x: t - backRabbet, y: D - tb, z: toe })
      boards.push(back)
      for (const side of [left, right]) joints.push(groove('rabbet', side, back, { width: tb, depth: backRabbet, offset: D - tb, along: 'length' }))
      notes.push(`The back sits in ${formatInches(backRabbet)} deep rabbets in the sides; tack it to the top and bottom.`)
    } else {
      const back = makeBoard('Back', backWood, W, boxH, ORIENT.uprightX, { x: 0, y: D - tb, z: toe })
      boards.push(back)
      for (const p of [left, right, bottom]) { joints.push(butt(back, p, { fastener: 'screws', count: SCREWS_PER_JOINT })); screws += SCREWS_PER_JOINT }
      notes.push('The back covers the back edges and is screwed to the sides and bottom; it squares the case.')
    }
  } else notes.push('No back: add a stretcher or keep the case against a wall so it does not rack.')

  // A wall cabinet hangs from a rail screwed into the studs.
  if (kind === 'wall') {
    const railZ = topUnderside - RAIL
    const rail = makeBoard('Hanging rail', wood, RAIL, inside, ORIENT.wallX, { x: t, y: partDepth - t, z: railZ })
    if (fixed && shelfZ.some(z => z + t > railZ && z < railZ + RAIL)) return { error: 'The top shelf is too close to the hanging rail; use fewer shelves' }
    boards.push(rail)
    for (const side of [left, right]) { joints.push(butt(side, rail, { fastener: 'screws', count: 2 })); screws += 2 }
    notes.push('Screw through the hanging rail into at least two wall studs.')
  }

  // A base cabinet stands on a toe kick, set back so feet fit under it.
  if (kind === 'base') {
    const kick = makeBoard('Toe kick', wood, toe, W, ORIENT.wallX, { x: 0, y: KICK_SETBACK, z: 0 })
    const kickBack = makeBoard('Base back', wood, toe, W, ORIENT.wallX, { x: 0, y: partDepth - 4, z: 0 })
    boards.push(kick, kickBack)
    for (const k of [kick, kickBack]) for (const p of [left, right, bottom]) { joints.push(butt(k, p, { fastener: 'screws', count: 2 })); screws += 2 }
    notes.push(`The toe kick is ${formatInches(toe)} high and set back ${formatInches(KICK_SETBACK)}.`)
  }

  if (screws) hardware.push({ itemId: 'screw-8-114', qty: screws, note: 'Case assembly' })
  if (pockets) hardware.push({ itemId: 'pocket-114', qty: pockets, note: 'Case assembly' })
  notes.push(`Inside width ${formatInches(snap64(inside))}; inside depth ${formatInches(snap64(partDepth))}.`)
  return { boards, joints: matchContacts(boards, woods, joints), hardware, pinShelves: fixed ? 0 : n, notes }
}

/** Host and partner the way each contact sees them, so every joint checks out like a hand-made one. */
function matchContacts(boards: Board[], woods: Wood[], joints: Joint[]): Joint[] {
  const p = { ...emptyProject('x'), boards, woods, joints: [] } as Project
  return joints.map(j => {
    const c = contactBetween(p, j.hostBoardId, j.partnerBoardId)
    if (!c || c.host === j.hostBoardId) return j
    // Grooves are cut in a particular part; only the butt-style joints swap.
    return j.type === 'butt' || j.type === 'pocketScrew' ? { ...j, hostBoardId: c.host, partnerBoardId: c.partner } : j
  })
}

export type CaseResult = { project: Project; groupId: string; notes: string[]; warnings: string[] }

/**
 * Adds the case to a design as one new group, set beside what's already there, with its hardware and (for
 * adjustable shelves) its pin holes. Returns the new design plus the notes and any check warnings for the new parts.
 */
export function addCase(p: Project, spec: CaseSpec, opts: { replaceId?: string } = {}): CaseResult | { error: string } {
  const plan = planCase(spec, p.woods)
  if ('error' in plan) return plan
  // In place of a block being split (at its corner), else beside the existing parts, 6" to their right.
  const block = opts.replaceId ? p.boards.find(b => b.id === opts.replaceId) : undefined
  if (opts.replaceId && !block) return { error: 'The block to split is gone' }
  if (block) {
    const { joints } = p
    p = { ...p, boards: p.boards.filter(b => b.id !== block.id), joints: joints.filter(j => j.hostBoardId !== block.id && j.partnerBoardId !== block.id) }
  }
  const at = block ? worldBox(block).min : { x: p.boards.length ? Math.max(...p.boards.map(b => worldBox(b).max.x)) + 6 : 0, y: 0, z: 0 }
  const boards = plan.boards.map(b => ({ ...b, position: { x: b.position.x + at.x, y: b.position.y + at.y, z: b.position.z + at.z } }))
  const added = addAsGroup(p, boards, plan.joints, nextName(p, KIND_LABELS[spec.kind]))
  let project = added.project
  if (plan.hardware.length) project = { ...project, hardware: [...(project.hardware ?? []), ...plan.hardware.map(h => ({ ...h, id: newId('p'), groupId: added.id }))] }
  if (plan.pinShelves) {
    const [l, r] = boards
    for (const [i, side] of [l, r].entries()) {
      const other = i === 0 ? r : l
      const res = addShelfPins(project, side.id, { ...PIN_DEFAULTS, face: faceToward(side, other), from: 4, to: 4, shelves: i === 0 ? plan.pinShelves : 0 })
      if ('error' in res) return res
      project = res
    }
  }
  const ids = new Set(boards.map(b => b.id))
  const warnings = [...validate(project), ...libraryAdvice(project)].filter(w => w.boardIds.some(id => ids.has(id))).map(w => w.message)
  // Shelves on pins have no joints, so the design checks can't see them as shelves: check their sag here.
  const loose = plan.pinShelves ? boards.find(b => b.name === 'Shelf') : undefined
  const wood = loose && p.woods.find(w => w.id === loose.woodId)
  if (loose && wood) {
    const s = sag({ span: loose.length, depth: loose.width, thickness: loose.thickness, moe: stiffnessOf(wood).moe, lbPerFt: 20 })
    if (!s.ok) warnings.push(`Sag: loaded with books, the adjustable shelves (${formatInches(loose.length)} span) will sag about ${formatInches(s.inches, { sixtyFourths: true })} — more than the ${formatInches(s.limit, { sixtyFourths: true })} most people notice. Make the case narrower, use thicker stock, or add a front edge strip.`)
  }
  return { project, groupId: added.id, notes: plan.notes, warnings: [...new Set(warnings)] }
}

/** A case spec sized to fill a block (width along x, depth along y, height along z). */
export function specForBlock(b: Board, base: CaseSpec): CaseSpec {
  const w = worldBox(b)
  return { ...base, W: snap64(w.max.x - w.min.x), H: snap64(w.max.z - w.min.z), D: snap64(w.max.y - w.min.y), wood: b.woodId }
}

/** The case alone, in a scratch design with the same woods: what the preview shows before anything is added. */
export function previewCase(p: Project, spec: CaseSpec): CaseResult | { error: string } {
  return addCase({ ...emptyProject(p.name), woods: p.woods }, spec)
}

export const jointsCheckOut = (p: Project) => p.joints.every(j => {
  const c = contactBetween(p, j.hostBoardId, j.partnerBoardId)
  return !!c && c.host === j.hostBoardId && jointOffers(c).includes(j.type)
})
