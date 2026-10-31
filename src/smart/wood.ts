// "What wood is this?": the online helper's guesses, kept to species the Library knows.
import { findSpecies, speciesById, type Species } from '../library/species'

export type WoodGuess = { species: Species; sure: 'likely' | 'maybe' | 'unsure'; look: string }

export function checkWoodAnswer(raw: unknown): WoodGuess[] | { error: string } {
  const r = raw as any
  if (!r || !Array.isArray(r.guesses)) return { error: "The helper's answer didn't name any woods." }
  const out: WoodGuess[] = []
  for (const g of r.guesses.slice(0, 5)) {
    if (!g || typeof g.species !== 'string') continue
    const sp = speciesById(g.species) ?? findSpecies(g.species)
    if (!sp || out.some(o => o.species.id === sp.id)) continue
    const sure = g.sure === 'likely' || g.sure === 'maybe' ? g.sure : 'unsure'
    out.push({ species: sp, sure, look: typeof g.look === 'string' ? g.look.slice(0, 300) : '' })
    if (out.length === 3) break
  }
  return out.length ? out : { error: "The helper couldn't match it to a wood in the Library. Try a photo of a freshly sanded face in daylight." }
}
