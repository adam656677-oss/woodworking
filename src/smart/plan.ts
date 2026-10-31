// Photo → plan and "describe a project": checking what the online helper sends back and turning it into a design.
// The helper's answer is never trusted as it comes: sizes are checked, scaled to the one known measurement and
// snapped to stock from the wood library.
import { emptyProject } from '../model/woods'
import type { Board, Project, Wood } from '../model/types'
import { snap64 } from '../model/units'
import { makeBoard, ORIENT } from '../templates/place'

export type Lies = 'flat-x' | 'flat-y' | 'wall-x' | 'wall-y' | 'upright-x' | 'upright-y'
const LIES: Record<Lies, keyof typeof ORIENT> = { 'flat-x': 'flatX', 'flat-y': 'flatY', 'wall-x': 'wallX', 'wall-y': 'wallY', 'upright-x': 'uprightX', 'upright-y': 'uprightY' }
export type PlanPart = { name: string; width: number; length: number; thickness: number; x: number; y: number; z: number; lies: Lies }
export type DraftPlan = { name: string; parts: PlanPart[]; steps: string[] }
export type Known = { dim: 'width' | 'depth' | 'height'; value: number }

const num = (v: unknown, lo: number, hi: number) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi
const isLies = (v: unknown): v is Lies => typeof v === 'string' && Object.hasOwn(LIES, v)
const str = (v: unknown, max = 200) => typeof v === 'string' && v.trim().length > 0 && v.length <= max

/** The helper's answer as a plan, or what's wrong with it. */
export function checkPlan(raw: unknown): DraftPlan | { error: string } {
  const r = raw as any
  if (!r || typeof r !== 'object' || !Array.isArray(r.parts)) return { error: "The helper's answer didn't have a list of parts." }
  if (r.parts.length === 0) return { error: "The helper couldn't find any parts in the picture." }
  if (r.parts.length > 60) return { error: 'The helper found more than 60 parts — try a simpler piece or a closer photo.' }
  const parts: PlanPart[] = []
  for (const p of r.parts) {
    if (!p || !str(p.name, 60) || !num(p.width, 0.1, 120) || !num(p.length, 0.1, 144) || !num(p.thickness, 0.1, 8) ||
      !num(p.x, -200, 200) || !num(p.y, -200, 200) || !num(p.z, -200, 200) || !isLies(p.lies)) {
      return { error: `The helper sent a part that doesn't make sense${p && typeof p.name === 'string' ? ` (${p.name.slice(0, 40)})` : ''}.` }
    }
    parts.push({ name: p.name.trim(), width: p.width, length: p.length, thickness: p.thickness, x: p.x, y: p.y, z: p.z, lies: p.lies })
  }
  const steps = Array.isArray(r.steps) ? r.steps.filter((s: unknown) => str(s, 500)).slice(0, 40).map((s: string) => s.trim()) : []
  return { name: str(r.name, 80) ? r.name.trim() : 'From a photo', parts, steps }
}

/** The world box a part fills, from its sizes and the way it lies. */
function extent(p: PlanPart): { x: number; y: number; z: number } {
  const { width: w, length: l, thickness: t } = p
  switch (p.lies) {
    case 'flat-x': return { x: l, y: w, z: t }
    case 'flat-y': return { x: w, y: l, z: t }
    case 'wall-x': return { x: l, y: t, z: w }
    case 'wall-y': return { x: t, y: l, z: w }
    case 'upright-x': return { x: w, y: t, z: l }
    case 'upright-y': return { x: t, y: w, z: l }
  }
}

/** Scales the plan so the known measurement comes out exactly (sizes and places; thicknesses come from stock later). */
export function scalePlan(plan: DraftPlan, known: Known | null): DraftPlan {
  if (!known || !(known.value > 0)) return plan
  const ax = known.dim === 'width' ? 'x' : known.dim === 'depth' ? 'y' : 'z'
  const lo = Math.min(...plan.parts.map(p => p[ax]))
  const hi = Math.max(...plan.parts.map(p => p[ax] + extent(p)[ax]))
  const span = hi - lo
  if (!(span > 0)) return plan
  const k = known.value / span
  return { ...plan, parts: plan.parts.map(p => ({ ...p, width: p.width * k, length: p.length * k, thickness: p.thickness * k, x: p.x * k, y: p.y * k, z: p.z * k })) }
}

/** After scaling: what's wrong if the parts came out too big or too small to build, else null. */
export function checkScaled(plan: DraftPlan): string | null {
  for (const p of plan.parts) {
    if (p.width > 120 || p.length > 144 || Math.abs(p.x) > 400 || Math.abs(p.y) > 400 || Math.abs(p.z) > 400) return `Scaled to that measurement, a part comes out too big to build (${p.name.slice(0, 40)}). Check the measurement and which one it is.`
    if (p.width < 0.1 || p.length < 0.1) return `Scaled to that measurement, a part comes out too small to make sense (${p.name.slice(0, 40)}). Check the measurement.`
  }
  return null
}

/** The stock wood that fits a part best: the nearest thickness, and wide enough if it can be. */
export function stockFor(p: { width: number; thickness: number }, woods: Wood[]): Wood {
  const score = (w: Wood) => Math.abs(w.thickness - p.thickness) * 4 + (p.width > w.width ? 2 + (p.width - w.width) / 12 : 0)
  return [...woods].sort((a, b) => score(a) - score(b))[0]
}

/** A new project from the plan: each part a board of the nearest stock, placed where the helper put it. */
export function planToProject(plan: DraftPlan, base: Project = emptyProject(plan.name)): Project {
  const boards: Board[] = plan.parts.map(p => {
    const wood = stockFor(p, base.woods)
    return makeBoard(p.name, wood, snap64(p.width), snap64(p.length), ORIENT[LIES[p.lies]], { x: snap64(p.x), y: snap64(p.y), z: snap64(p.z) })
  })
  return { ...base, name: plan.name, boards, joints: [] }
}
