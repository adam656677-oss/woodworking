// Wood densities for weight (lb/ft³, air-dry at about 12% moisture): the Deep Library's species, then these rough matches.
import { findSpecies } from '../library/species'
const TABLE: [RegExp, number][] = [
  // Sheet goods first: "Birch plywood" weighs as plywood, not birch.
  [/plywood|\bply\b/, 34], [/\bmdf\b/, 47],
  [/white\s*oak/, 47], [/red\s*oak/, 44], [/\boak\b/, 45], [/hard\s*maple/, 44], [/\bmaple\b/, 40], [/cherry/, 35],
  [/walnut/, 38], [/cedar/, 23], [/\bash\b/, 41], [/birch/, 43], [/hickory/, 50], [/mahogany/, 34], [/douglas\s*fir/, 33],
  [/\bfir\b/, 30], [/spruce/, 27], [/basswood/, 26], [/teak/, 41], [/poplar/, 29], [/\bpine\b/, 28],
  [/hardwood/, 42]
]
export const DEFAULT_DENSITY = 35

/** Density of a species by name; `estimated` when the name isn't known. */
export function densityOf(species: string): { lbPerCuFt: number; estimated: boolean } {
  // A species from the Deep Library first (sheet goods are matched by the table, below).
  const sp = /plywood|\bply\b|\bmdf\b/i.test(species) ? undefined : findSpecies(species)
  if (sp) return { lbPerCuFt: sp.density, estimated: false }
  const s = species.toLowerCase()
  for (const [re, v] of TABLE) if (re.test(s)) return { lbPerCuFt: v, estimated: false }
  return { lbPerCuFt: DEFAULT_DENSITY, estimated: true }
}
