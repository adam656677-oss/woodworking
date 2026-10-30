// Wood densities for weight (lb/ft³, air-dry at about 12% moisture). The Deep Library (Piece 11) will supersede this.
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
  const s = species.toLowerCase()
  for (const [re, v] of TABLE) if (re.test(s)) return { lbPerCuFt: v, estimated: false }
  return { lbPerCuFt: DEFAULT_DENSITY, estimated: true }
}
