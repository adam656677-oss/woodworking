// The Games list in the Kids' Workshop.
import { Art } from '../../kids/art'
import { kids } from '../../kids/kidsStore'
import { KidsPageFrame } from '../../kids/ui/kit'

import type { GameId } from '../types'
export type { GameId }
const GAMES: { id: GameId; name: string; about: string; art: string; color: string }[] = [
  { id: 'tape', name: 'Read the Tape', about: 'Read a tape measure, down to the tiny marks.', art: 'tape-measure', color: 'border-yellow-400 bg-yellow-100' },
  { id: 'hazard', name: 'Spot the Hazard', about: 'Find the 8 dangers in the shop.', art: 'ear-muffs', color: 'border-red-400 bg-red-100' },
  { id: 'wood', name: 'Match the Wood', about: 'Which wood is it? Use the clue.', art: 'wood-grain', color: 'border-amber-500 bg-amber-100' },
  { id: 'joint', name: 'Joint Puzzle', about: 'Fit the pieces and name the joint.', art: 'tic-tac-toe', color: 'border-teal-400 bg-teal-100' },
  { id: 'lathe', name: 'Lathe Turning', about: 'Turn a pen, a bowl or a candlestick.', art: 'block-plane', color: 'border-sky-400 bg-sky-100' }
]

export function GamesHome() {
  return (
    <KidsPageFrame title="Games">
      <div className="grid max-w-5xl grid-cols-3 gap-6">
        {GAMES.map(g => (
          <button key={g.id} onClick={() => kids.getState().go({ name: 'game', id: g.id })} className={`flex h-56 flex-col items-center justify-center gap-2 rounded-3xl border-4 p-4 shadow-lg hover:scale-105 ${g.color}`}>
            <Art name={g.art} className="block h-20 w-20" />
            <span className="text-2xl font-bold">{g.name}</span>
            <span className="text-base">{g.about}</span>
          </button>
        ))}
      </div>
    </KidsPageFrame>
  )
}
