// Match the Wood: a board and a clue — which wood is it?
import { useEffect, useMemo, useRef, useState } from 'react'
import { speciesById } from '../../library/species'
import { woodLook } from '../../render/materials'
import { grainPixels } from '../grain2d'
import { rng } from '../rng'
import { KID_WOODS, woodRound } from '../woods'
import { Feedback, GamePage, RoundEnd, useRound } from './common'

function Board({ id, seed }: { id: string; seed: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    const s = speciesById(id)
    const look = woodLook({ id, name: s?.name ?? id, kind: 'hardwood', species: s?.name ?? '', thickness: 0.75, width: 6, length: 24, builtIn: false })
    const img = ctx.createImageData(c.width, c.height)
    img.data.set(grainPixels(look, c.width, c.height, 24, seed))
    ctx.putImageData(img, 0, 0)
  }, [id, seed])
  return <canvas ref={ref} width={480} height={120} role="img" aria-label="A board of the mystery wood" className="w-full max-w-2xl rounded-lg border-4 border-amber-900/30 shadow" />
}

const nameOf = (id: string) => KID_WOODS.find(w => w.id === id)!.name

export function WoodGame() {
  const r = useMemo(() => rng(Date.now() % 100000), [])
  const [q, setQ] = useState(() => woodRound(r))
  const [seed, setSeed] = useState(() => r())
  const [picked, setPicked] = useState<string | null>(null)
  const round = useRound()
  const next = () => { setQ(woodRound(r)); setSeed(r()); setPicked(null) }
  return (
    <GamePage title="Match the Wood" how="Look at the board and read the clue. Which wood is it?">
      {round.done && !picked ? <RoundEnd right={round.right} onAgain={() => { round.again(); next() }} /> : <>
        <p className="mb-2 text-lg text-sky-800">Question {Math.min(round.asked + (picked ? 0 : 1), 10)} of 10</p>
        <Board id={q.answer} seed={seed} />
        <p aria-label="Clue" className="mt-4 max-w-3xl rounded-2xl bg-white p-4 text-2xl shadow">🔎 {q.clue}</p>
        <div role="group" aria-label="Choices" className="mt-4 flex flex-wrap gap-3">
          {q.choices.map(c => (
            <button key={c} disabled={picked !== null} onClick={() => { setPicked(c); round.answer(c === q.answer) }}
              className={`min-w-40 rounded-2xl px-6 py-4 text-2xl font-bold shadow ${picked && c === q.answer ? 'bg-green-500 text-white' : picked === c ? 'bg-amber-400' : 'bg-white hover:bg-sky-100'}`}>{nameOf(c)}</button>
          ))}
        </div>
        {picked && <Feedback ok={picked === q.answer} onNext={next}>{picked === q.answer ? `Yes — ${nameOf(q.answer)}!` : `That one's ${nameOf(q.answer)}.`} {speciesById(q.answer)?.uses}</Feedback>}
      </>}
    </GamePage>
  )
}
