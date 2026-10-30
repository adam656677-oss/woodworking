// The finish selector: say what matters, get finishes ranked with the reasons.
import { TOPCOATS, type Finish, type Method } from './finishes'

export type Want = 'durable' | 'food' | 'easy' | 'clear' | 'water' | 'repair' | 'smell' | 'heat'
export const WANTS: { id: Want; label: string }[] = [
  { id: 'durable', label: 'Tough (tables, floors, kids)' },
  { id: 'water', label: 'Stands up to water' },
  { id: 'heat', label: 'Stands up to heat (hot mugs)' },
  { id: 'food', label: 'Food-safe (cutting boards, bowls)' },
  { id: 'easy', label: 'Easy to put on' },
  { id: 'clear', label: 'Stays clear (no yellowing)' },
  { id: 'repair', label: 'Easy to repair later' },
  { id: 'smell', label: 'Low smell (indoors, no spray booth)' }
]

export type Ranked = { finish: Finish; score: number; reasons: string[]; warnings: string[] }

/** Topcoats ranked for these wants, using only the ways of applying it you can do. */
export function rankFinishes(wants: Want[], methods: Method[] = ['wipe', 'brush', 'spray']): Ranked[] {
  const out: Ranked[] = []
  for (const f of TOPCOATS) {
    if (!f.methods.some(m => methods.includes(m))) continue
    if (wants.includes('food') && f.food === 'no') continue
    const reasons: string[] = [], warnings: string[] = []
    let score = 0
    const rate = (n: number, good: string, bad: string) => { score += n; if (n >= 4) reasons.push(good); else if (n <= 2) warnings.push(bad) }
    for (const w of wants) {
      if (w === 'durable') rate(f.durability, 'Very tough', 'Not very tough')
      if (w === 'water') rate(f.water, 'Resists water well', 'Water marks it easily')
      if (w === 'heat') rate(f.heat, 'Handles heat well', 'Hot things can mark it')
      if (w === 'easy') rate(f.ease, 'Easy to get a good result', 'Takes skill or special equipment')
      if (w === 'repair') rate(f.repair, 'Easy to repair or renew', 'Hard to repair invisibly')
      if (w === 'smell') rate(6 - f.smell, 'Low smell', 'Strong fumes — ventilate well')
      if (w === 'clear') { const n = f.ambers ? 2 : 5; score += n; if (n === 5) reasons.push('Stays clear, doesn\'t yellow'); else warnings.push('Ambers (yellows) over time') }
      if (w === 'food') { const n = f.food === 'yes' ? 5 : 4; score += n; reasons.push(f.food === 'yes' ? 'Food-safe as soon as it\'s on' : `Food-safe once fully cured (${f.cure} days)`) }
    }
    if (!wants.length) score = f.durability + f.ease
    out.push({ finish: f, score: score / Math.max(1, wants.length), reasons, warnings })
  }
  return out.sort((a, b) => b.score - a.score || b.finish.ease - a.finish.ease || a.finish.name.localeCompare(b.finish.name))
}
