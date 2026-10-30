// Doors swing and drawers slide: where their parts are when open (display and the clearance check).
import * as THREE from 'three'
import { ancestry, groupBoardIds, groupsOf } from '../assemblies/ops'
import { interferences, localSolids } from '../checks/solids'
import { worldBox, type Box } from '../model/geometry'
import type { Board, Group, Motion, Project, Vec3 } from '../model/types'

/** The outermost group that moves this part, if any. */
export function moverOf(p: Project, b: Board): Group | undefined {
  return [...ancestry(p, b.groupId)].reverse().find(g => g.motion)
}

/** A swing's angle in degrees about the vertical hinge line at `amount` (0 closed … 1 fully open). */
export const swingDeg = (m: Extract<Motion, { kind: 'swing' }>, amount: number) => m.dir * m.maxDeg * Math.min(1, Math.max(0, amount))

const RAD = Math.PI / 180
/** Where a part is when its door or drawer is `amount` open. */
export function movedBoard(b: Board, m: Motion, amount: number): Board {
  if (m.kind === 'slide') {
    const t = m.travel * Math.min(1, Math.max(0, amount))
    return { ...b, position: { x: b.position.x + m.dir.x * t, y: b.position.y + m.dir.y * t, z: b.position.z + m.dir.z * t } }
  }
  const a = swingDeg(m, amount) * RAD
  const turn = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), a)
  const q = turn.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(b.rotation.x * RAD, b.rotation.y * RAD, b.rotation.z * RAD, 'XYZ')))
  const e = new THREE.Euler().setFromQuaternion(q, 'XYZ')
  const rel = new THREE.Vector3(b.position.x - m.origin.x, b.position.y - m.origin.y, b.position.z - m.origin.z).applyAxisAngle(new THREE.Vector3(0, 0, 1), a)
  const r = (v: number) => Math.round(v * 1e9) / 1e9 + 0
  return { ...b, rotation: { x: r(e.x / RAD), y: r(e.y / RAD), z: r(e.z / RAD) }, position: { x: r(m.origin.x + rel.x), y: r(m.origin.y + rel.y), z: r(m.origin.z + rel.z) } }
}

/** The design with every door and drawer `amount` open. */
export function opened(p: Project, amount: number): Project {
  if (amount <= 0 || !groupsOf(p).some(g => g.motion)) return p
  return { ...p, boards: p.boards.map(b => { const g = moverOf(p, b); return g ? movedBoard(b, g.motion!, amount) : b }) }
}

export type Clash = { groupId: string; otherId: string; percent: number }
const STEPS = 10
const overlaps = (a: Box, b: Box) => (['x', 'y', 'z'] as const).every(k => a.min[k] < b.max[k] - 1e-6 && b.min[k] < a.max[k] - 1e-6)
const union = (bs: Box[]): Box => ({
  min: { x: Math.min(...bs.map(b => b.min.x)), y: Math.min(...bs.map(b => b.min.y)), z: Math.min(...bs.map(b => b.min.z)) },
  max: { x: Math.max(...bs.map(b => b.max.x)), y: Math.max(...bs.map(b => b.max.y)), z: Math.max(...bs.map(b => b.max.z)) }
})

/**
 * Steps each door and drawer from closed to open and reports the first position where it runs into another part
 * (parts it already touches when closed — its own hinge side, say — don't count).
 */
export function clearance(p: Project): Clash[] {
  const solids = localSolids(p)
  const out: Clash[] = []
  for (const g of groupsOf(p).filter(x => x.motion)) {
    const ids = new Set(groupBoardIds(p, g.id))
    const moving = p.boards.filter(b => ids.has(b.id) && moverOf(p, b)?.id === g.id)
    if (!moving.length) continue
    const stepsAt = (k: number) => moving.map(b => movedBoard(b, g.motion!, k / STEPS))
    const swept = union(Array.from({ length: STEPS + 1 }, (_, k) => stepsAt(k)).flat().map(worldBox))
    const others = p.boards.filter(b => !ids.has(b.id) && overlaps(worldBox(b), swept))
    if (!others.length) continue
    const pairsAt = (k: number) => {
      const sub: Project = { ...p, boards: [...stepsAt(k), ...others], joints: [] }
      return interferences(sub, solids).filter(i => ids.has(i.a) !== ids.has(i.b)).map(i => (ids.has(i.a) ? i.b : i.a))
    }
    const already = new Set(pairsAt(0))
    const found = new Set<string>()
    for (let k = 1; k <= STEPS; k++) {
      for (const other of pairsAt(k)) {
        if (already.has(other) || found.has(other)) continue
        found.add(other)
        out.push({ groupId: g.id, otherId: other, percent: k * (100 / STEPS) })
      }
    }
  }
  return out
}

/** "Door 1 hits Drawer 2 at 60% open." */
export function clashText(p: Project, c: Clash): string {
  const g = groupsOf(p).find(x => x.id === c.groupId)?.name ?? '?'
  const b = p.boards.find(x => x.id === c.otherId)
  const owner = b ? [...ancestry(p, b.groupId)].reverse()[0]?.name : undefined
  return `${g} hits ${owner ?? b?.name ?? '?'} at ${c.percent}% open`
}

export type { Vec3 }
