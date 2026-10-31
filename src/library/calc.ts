// Wood movement and shelf sag.
import { findSpecies, SHEET_MOE, type Species } from './species'
import type { Wood } from '../model/types'

export type Cut = 'flat' | 'quarter'

/** Dimensional change coefficient per 1% moisture change: the Handbook's where listed, else estimated from total shrinkage. */
export function moveCoef(s: Species, cut: Cut): { coef: number; estimated: boolean } {
  if (s.coef) return { coef: cut === 'flat' ? s.coef[0] : s.coef[1], estimated: false }
  // The Handbook's own coefficients are about total shrinkage ÷ 28.5 (cedars and redwood less).
  return { coef: (cut === 'flat' ? s.shrinkT : s.shrinkR) / 100 / 28.5, estimated: true }
}

/** How much a board's width changes between two moisture contents (inches; positive = it swells). */
export function movement(width: number, s: Species, fromMc: number, toMc: number, cut: Cut = 'flat'): { inches: number; estimated: boolean } {
  const { coef, estimated } = moveCoef(s, cut)
  // Below the fibre saturation point only (about 28%).
  const a = Math.min(fromMc, 28), b = Math.min(toMc, 28)
  return { inches: width * coef * (b - a), estimated }
}

/** Shelf load presets, pounds per foot of shelf. */
export const LOADS = [
  { id: 'books', label: 'Books', lbPerFt: 20 },
  { id: 'heavy-books', label: 'Big books, records', lbPerFt: 35 },
  { id: 'dishes', label: 'Dishes', lbPerFt: 15 },
  { id: 'clothes', label: 'Folded clothes', lbPerFt: 10 },
  { id: 'display', label: 'Display (light)', lbPerFt: 5 }
]
/** Sag people notice: more than 0.02" per foot of span (the common rule of thumb). */
export const SAG_LIMIT_PER_FT = 0.02

/**
 * Sag in the middle of a shelf with an even load, its ends simply resting on supports (a dado holds a little
 * better, so this errs on the safe side): 5 w L⁴ / (384 E I).
 */
export function sag(o: { span: number; depth: number; thickness: number; moe: number; lbPerFt: number }): { inches: number; limit: number; ok: boolean } {
  const w = o.lbPerFt / 12
  const I = (o.depth * o.thickness ** 3) / 12
  const E = o.moe * 1e6
  const inches = (5 * w * o.span ** 4) / (384 * E * I)
  const limit = (o.span / 12) * SAG_LIMIT_PER_FT
  return { inches, limit, ok: inches <= limit }
}

/** Stiffness (million psi) and a name for a wood in the design: sheet goods by kind, solid wood by species. */
export function stiffnessOf(w: Wood): { moe: number; label: string; estimated: boolean } {
  if (w.kind === 'sheet') {
    const m = SHEET_MOE.find(x => x.match.test(`${w.name} ${w.species}`))
    return m ? { moe: m.moe, label: m.label, estimated: false } : { moe: 1.0, label: 'Sheet goods', estimated: true }
  }
  const s = findSpecies(w.species) ?? findSpecies(w.name)
  // Unknown solid wood: plan for a soft pine.
  return s ? { moe: s.moe, label: s.name, estimated: false } : { moe: 1.24, label: `${w.species || w.name} (unknown — using white pine)`, estimated: true }
}
