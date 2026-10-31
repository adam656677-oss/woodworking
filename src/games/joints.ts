// Joint Puzzle: one part is cut for a joint; which partner fits it? Drawn from the side on a grid:
// '#' is the part's wood, 's' is the space it leaves for the partner (the socket), '.' is open air.
// A partner fits when it fills every socket cell and touches none of the part's wood.
import { pick, shuffle, type Rng } from './rng'

export type Grid = string[]
export type Puzzle = { id: string; name: string; names: string[]; host: Grid; partners: Grid[]; answer: number; about: string }

export function fits(host: Grid, partner: Grid): boolean {
  let filled = 0, touches = false
  const at = (g: Grid, x: number, y: number) => g[y]?.[x] ?? '.'
  for (let y = 0; y < host.length; y++) for (let x = 0; x < host[y].length; x++) {
    const h = host[y][x], p = partner[y]?.[x] ?? '.'
    if (h === '#' && p === '#') return false
    if (h === 's' && p !== '#') return false
    if (p === '#') {
      filled++
      // It has to meet the board: right up against its wood or in its socket.
      if (h === 's' || [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => at(host, x + dx, y + dy) === '#')) touches = true
    }
  }
  return filled > 0 && touches
}

const P = (id: string, name: string, others: string[], host: Grid, right: Grid, wrong: Grid[], about: string): Puzzle => {
  const partners = [right, ...wrong]
  return { id, name, names: [name, ...others], host, partners, answer: 0, about }
}

export const PUZZLES: Puzzle[] = [
  P('butt', 'Butt joint', ['Lap joint', 'Dado'],
    ['###.....', '###.....', '###.....', '###.....'],
    ['...#####', '...#####', '...#####', '...#####'],
    [['###.....', '...#####', '...#####', '...#####'], ['..######', '..######', '..######', '..######']],
    'The end of one board just meets the other. Easy, but it needs glue and screws or nails to hold.'),
  P('lap', 'Lap joint', ['Butt joint', 'Dado'],
    ['####ssss....', '####ssss....', '########....', '########....'],
    ['....########', '....########', '........####', '........####'],
    [['....########', '....########', '....########', '........####'], ['.....#######', '.....#######', '........####', '........####']],
    'Each board gives up half its thickness, so they overlap and the faces stay flush.'),
  P('dado', 'Dado', ['Rabbet', 'Box joint'],
    ['###.....', '##s.....', '##s.....', '###.....'],
    ['........', '..######', '..######', '........'],
    [['........', '...#####', '...#####', '........'], ['..######', '..######', '..######', '........']],
    'A groove across the side holds the end of a shelf: strong and it lines the shelf up for you.'),
  P('rabbet', 'Rabbet', ['Dado', 'Lap joint'],
    ['###.....', '###.....', '#ss.....', '#ss.....'],
    ['........', '........', '.#######', '.#######'],
    [['........', '........', '..######', '..######'], ['........', '.#######', '.#######', '.#######']],
    'A step cut along the edge: the other board sits in it. Used for box corners and cabinet backs.'),
  P('box', 'Box joint', ['Dovetail', 'Lap joint'],
    ['###ss...', '#####...', '###ss...', '#####...', '###ss...'],
    ['...#####', '.....###', '...#####', '.....###', '...#####'],
    [['.....###', '...#####', '.....###', '...#####', '.....###'], ['...#####', '...#####', '...#####', '.....###', '...#####']],
    'Square fingers on both boards lock together like your fingers. Lots of glue surface makes it strong.'),
  P('tongue', 'Tongue and groove', ['Rabbet', 'Butt joint'],
    ['####....', '###s....', '####....'],
    ['....####', '...#####', '....####'],
    [['...#####', '....####', '...#####'], ['....####', '....####', '....####']],
    'A tongue on one edge slides into a groove in the other — the way floorboards fit together.'),
  P('tenon', 'Mortise and tenon', ['Dowel joint', 'Box joint'],
    ['###.....', '#ss.....', '#ss.....', '###.....'],
    ['...#####', '.#######', '.#######', '...#####'],
    [['..######', '.#######', '.#######', '..######'], ['...#####', '..######', '..######', '...#####']],
    'A tenon on the end of a rail fits a hole (the mortise) in the leg. One of the strongest joints there is.')
]

export type PuzzleRound = { puzzle: Puzzle; order: number[]; names: string[] }
/** A puzzle with its partners and names in a random order. */
export function puzzleRound(r: Rng, id?: string): PuzzleRound {
  const puzzle = id ? PUZZLES.find(p => p.id === id)! : pick(r, PUZZLES)
  return { puzzle, order: shuffle(r, puzzle.partners.map((_, i) => i)), names: shuffle(r, puzzle.names) }
}
