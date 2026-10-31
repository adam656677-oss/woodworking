// Match the Wood: eight woods kids meet first, each with clues in kids' words (from the Deep Library facts).
import { speciesById } from '../library/species'
import { pick, shuffle, type Rng } from './rng'

export type KidWood = { id: string; name: string; clues: string[] }

export const KID_WOODS: KidWood[] = [
  { id: 'eastern-white-pine', name: 'Pine', clues: ['Soft, light and pale, with brown knots — the wood at every home store.', 'Light and soft enough to dent with a fingernail — builders use it for trim and shelves.'] },
  { id: 'red-oak', name: 'Red oak', clues: ['Hard and heavy, with big open pores you can see.', 'Its open pores are so big you can blow air through the end of a thin piece.'] },
  { id: 'hard-maple', name: 'Maple', clues: ['Very hard and creamy white — used for cutting boards and bowling alleys.', 'So smooth and hard that baseball bats are made from it.'] },
  { id: 'black-walnut', name: 'Walnut', clues: ['Dark chocolate brown — the darkest wood in this game.', 'The tree grows nuts with a hard shell, and the wood is dark brown.'] },
  { id: 'black-cherry', name: 'Cherry', clues: ['Pinky-brown when new, and it turns a deep red-brown in sunlight.', 'The tree has small dark fruit that birds love.'] },
  { id: 'western-red-cedar', name: 'Cedar', clues: ['Smells strong and spicy, and bugs and rot leave it alone — great for birdhouses.', 'Light, reddish and stands up to rain without paint.'] },
  { id: 'basswood', name: 'Basswood', clues: ['Very soft and even — the favourite wood for carving with a knife.', 'Pale with almost no grain, easy to cut and sand.'] },
  { id: 'yellow-poplar', name: 'Poplar', clues: ['Pale with green or purple streaks — usually painted.', 'A cheap, easy hardwood that often has a greenish stripe.'] }
]

export const woodColour = (id: string) => speciesById(id)?.colour ?? '#c9a57e'

export type WoodRound = { answer: string; clue: string; choices: string[] }

export function woodRound(r: Rng): WoodRound {
  const w = pick(r, KID_WOODS)
  const others = shuffle(r, KID_WOODS.filter(x => x.id !== w.id)).slice(0, 2).map(x => x.id)
  return { answer: w.id, clue: pick(r, w.clues), choices: shuffle(r, [w.id, ...others]) }
}
