// Joint Puzzle: which piece fits the cut part? Then: what's the joint called?
import { useMemo, useRef, useState } from 'react'
import { fits, PUZZLES, puzzleRound, type Grid } from '../joints'
import { rng, shuffle } from '../rng'
import { Feedback, GamePage, RoundEnd, useRound } from './common'

const C = 34

/** The part (dark wood, its socket dashed) with a partner (light wood) laid in place. */
function PuzzlePicture({ host, partner, label }: { host: Grid; partner?: Grid; label: string }) {
  const w = host[0].length * C, h = host.length * C
  return (
    <svg role="img" aria-label={label} viewBox={`-4 -4 ${w + 8} ${h + 8}`} className="h-44 w-64">
      {host.flatMap((row, y) => [...row].map((c, x) => c === '#' ? <rect key={`h${x},${y}`} x={x * C} y={y * C} width={C} height={C} fill="#a8703c" /> : c === 's' ? <rect key={`s${x},${y}`} x={x * C + 2} y={y * C + 2} width={C - 4} height={C - 4} fill="none" stroke="#a8703c" strokeDasharray="5 4" strokeWidth={2} /> : null))}
      {partner?.flatMap((row, y) => [...row].map((c, x) => c === '#' ? <rect key={`p${x},${y}`} x={x * C} y={y * C} width={C} height={C} fill="#f0c98b" opacity={0.85} stroke={host[y][x] === '#' ? '#d6453d' : 'none'} strokeWidth={3} /> : null))}
    </svg>
  )
}

/** A piece on its own, for choosing. */
function Piece({ g }: { g: Grid }) {
  const w = g[0].length * C, h = g.length * C
  return (
    <svg viewBox={`-4 -4 ${w + 8} ${h + 8}`} className="h-32 w-48" aria-hidden>
      {g.flatMap((row, y) => [...row].map((c, x) => c === '#' ? <rect key={`${x},${y}`} x={x * C} y={y * C} width={C} height={C} fill="#f0c98b" stroke="#c49a5a" /> : null))}
    </svg>
  )
}

export function JointGame() {
  const r = useMemo(() => rng(Date.now() % 100000), [])
  // A shuffled deck, so the same puzzle doesn't come twice in a row.
  const deck = useRef<string[]>([])
  const draw = () => { if (!deck.current.length) deck.current = shuffle(r, PUZZLES.map(p => p.id)); return puzzleRound(r, deck.current.pop()) }
  const [q, setQ] = useState(() => draw())
  const [chosen, setChosen] = useState<number | null>(null)
  const [name, setName] = useState<string | null>(null)
  const round = useRound()
  const p = q.puzzle
  const next = () => { setQ(draw()); setChosen(null); setName(null) }
  const fitOk = chosen !== null && fits(p.host, p.partners[chosen])
  return (
    <GamePage title="Joint Puzzle" how="The dark board is cut to join another board. Pick the light piece that fits with no gaps and no bumps, then name the joint.">
      {round.done && !name ? <RoundEnd right={round.right} onAgain={() => { round.again(); next() }} /> : <>
        <p className="mb-2 text-lg text-sky-800">Puzzle {Math.min(round.asked + (name ? 0 : 1), 10)} of 10</p>
        <div className="flex flex-wrap items-center gap-6">
          <div className="rounded-2xl bg-white p-3 shadow"><PuzzlePicture host={p.host} partner={chosen !== null ? p.partners[chosen] : undefined} label="The cut board" /></div>
          {chosen === null && (
            <div role="group" aria-label="Pieces" className="flex flex-wrap gap-3">
              {q.order.map((i, k) => <button key={i} aria-label={`Piece ${k + 1}`} onClick={() => setChosen(i)} className="rounded-2xl bg-white p-2 shadow hover:bg-sky-100"><Piece g={p.partners[i]} /></button>)}
            </div>
          )}
        </div>
        {chosen !== null && !fitOk && <Feedback ok={false} next="Try again" onNext={() => setChosen(null)}>That piece {p.partners[chosen].some((row, y) => [...row].some((c, x) => c === '#' && p.host[y][x] === '#')) ? 'bumps into the board (see the red)' : 'leaves a gap'}. Try another one!</Feedback>}
        {fitOk && (
          <div className="mt-4">
            <p className="mb-2 text-2xl font-semibold">It fits! What is this joint called?</p>
            <div role="group" aria-label="Joint names" className="flex flex-wrap gap-3">
              {q.names.map(n => <button key={n} disabled={name !== null} onClick={() => { setName(n); round.answer(n === p.name) }} className={`rounded-2xl px-6 py-3 text-xl font-bold shadow ${name && n === p.name ? 'bg-green-500 text-white' : name === n ? 'bg-amber-400' : 'bg-white hover:bg-sky-100'}`}>{n}</button>)}
            </div>
            {name && <Feedback ok={name === p.name} onNext={next} say={p.about}>{name === p.name ? 'Right — ' : `It's a ${p.name.toLowerCase()}. `}{p.about}</Feedback>}
          </div>
        )}
      </>}
    </GamePage>
  )
}
