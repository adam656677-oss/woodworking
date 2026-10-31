// One game, by id.
import type { GameId } from './GamesHome'
import { HazardGame } from './HazardGame'
import { JointGame } from './JointGame'
import { LatheGame } from './LatheGame'
import { TapeGame } from './TapeGame'
import { WoodGame } from './WoodGame'

export function Game({ id }: { id: GameId }) {
  switch (id) {
    case 'tape': return <TapeGame />
    case 'hazard': return <HazardGame />
    case 'wood': return <WoodGame />
    case 'joint': return <JointGame />
    case 'lathe': return <LatheGame />
  }
}
