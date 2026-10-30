// Cutting allowances per material, with sensible defaults by kind of wood.
import type { Project, StockSettings, Wood } from '../model/types'

export const DEFAULTS: Record<Wood['kind'], StockSettings> = {
  sheet: { kerf: 0.125, edgeTrim: 0.25, endTrim: 0.25, allowance: 0 },
  lumber: { kerf: 0.125, edgeTrim: 0, endTrim: 0.5, allowance: 0 },
  hardwood: { kerf: 0.125, edgeTrim: 0.5, endTrim: 1, allowance: 0 }
}
export const HARDWOOD_WASTE = 0.2
export const HARDWOOD_BOARD = { width: 6, length: 96 }

const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : d)

/** The allowances for a wood: the project's own where set, else the defaults for its kind. */
export function settingsFor(p: Project, w: Wood): StockSettings {
  const d = DEFAULTS[w.kind]
  const own = p.cutSettings?.byWood?.[w.id] ?? {}
  return { kerf: num(own.kerf, d.kerf), edgeTrim: num(own.edgeTrim, d.edgeTrim), endTrim: num(own.endTrim, d.endTrim), allowance: num(own.allowance, d.allowance) }
}
export function setSettings(p: Project, woodId: string, patch: Partial<StockSettings>): Project {
  const cs = p.cutSettings ?? {}
  return { ...p, cutSettings: { ...cs, byWood: { ...(cs.byWood ?? {}), [woodId]: { ...(cs.byWood?.[woodId] ?? {}), ...patch } } } }
}
export function setCutOption(p: Project, patch: Partial<Omit<NonNullable<Project['cutSettings']>, 'byWood'>>): Project {
  return { ...p, cutSettings: { ...(p.cutSettings ?? {}), ...patch } }
}
