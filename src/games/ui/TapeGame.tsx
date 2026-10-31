// Read the Tape: what does the arrow point at? And: find a measurement on the tape.
import { useMemo, useState } from 'react'
import { explainTape, findOk, tapeRound, tapeText, TAPE_LEVELS } from '../tape'
import { rng } from '../rng'
import { Feedback, GamePage, RoundEnd, svgPoint, useRound } from './common'
import { ReadAloud } from '../../kids/ui/ReadAloud'

const SPAN = 12
/** A measurement as words for the read-aloud voice: 3-5/8" → "3 and 5 eighths inches". */
const speakInches = (v: number) => tapeText(v).replace('"', ' inches').replace(/(\d+)-(\d+)\/(\d+)/, '$1 and $2 over $3').replace(/^(\d+)\/(\d+)/, '$1 over $2')
const PX = 90 // pixels per inch on the drawn tape

/** A tape measure from 0 to 12", ticks down to sixteenths, an arrow at `at` and a mark where the child tapped. */
export function Tape({ at, tapped, onTap, den, from = 0 }: { at?: number; tapped?: number; onTap?(v: number): void; den: number; from?: number }) {
  // Eighths and sixteenths: a 6" stretch, drawn twice as big, so the little marks can be told apart.
  const span = den >= 8 ? 6 : SPAN
  const px = (PX * SPAN) / span
  const W = span * px + 40
  const X = (v: number) => 20 + (v - from) * px
  const ticks: JSX.Element[] = []
  for (let k = from * 16; k <= (from + span) * 16; k++) {
    const v = k / 16
    const len = k % 16 === 0 ? 46 : k % 8 === 0 ? 34 : k % 4 === 0 ? 26 : k % 2 === 0 ? 18 : 12
    const shown = k % (16 / Math.max(den, 1)) === 0 || den >= 8
    ticks.push(<line key={k} x1={X(v)} x2={X(v)} y1={20} y2={20 + len} stroke="#222" strokeWidth={k % 16 === 0 ? 2.5 : 1.2} opacity={shown ? 1 : 0.35} />)
    if (k % 16 === 0 && k > 0) ticks.push(<text key={`t${k}`} x={X(v)} y={92} fontSize={22} textAnchor="middle" fontWeight={700} fill="#222">{k / 16}</text>)
  }
  return (
    <svg role="img" aria-label="Tape measure" viewBox={`0 0 ${W} 140`} className="w-full max-w-5xl cursor-pointer select-none rounded-xl bg-yellow-300 shadow"
      onClick={e => {
        if (!onTap) return
        const { x } = svgPoint(e.currentTarget as SVGSVGElement, e.clientX, e.clientY)
        onTap(Math.max(from, Math.min(from + span, from + (x - 20) / px)))
      }}>
      <rect x={0} y={14} width={W} height={2} fill="#222" />
      {ticks}
      {at !== undefined && <><line x1={X(at)} x2={X(at)} y1={16} y2={106} stroke="#d6453d" strokeWidth={2} /><path d={`M ${X(at)} 104 l -12 26 h 24 z`} fill="#d6453d" stroke="#7a1d18" strokeWidth={2} /></>}
      {tapped !== undefined && <line x1={X(tapped)} x2={X(tapped)} y1={14} y2={130} stroke="#1f6fd1" strokeWidth={4} />}
    </svg>
  )
}

export function TapeGame() {
  const [level, setLevel] = useState(1)
  const [mode, setMode] = useState<'read' | 'find'>('read')
  const r = useMemo(() => rng(Date.now() % 100000), [])
  const [q, setQ] = useState(() => tapeRound(1, r))
  const [picked, setPicked] = useState<number | null>(null)
  const [tapped, setTapped] = useState<number | undefined>()
  const round = useRound()
  const next = () => { setQ(tapeRound(level, r)); setPicked(null); setTapped(undefined) }
  const restart = (lv = level, m = mode) => { setLevel(lv); setMode(m); round.again(); setQ(tapeRound(lv, r)); setPicked(null); setTapped(undefined) }
  const answered = mode === 'read' ? picked !== null : tapped !== undefined
  const ok = mode === 'read' ? picked === q.answer : tapped !== undefined && findOk(q.answer, tapped, q.den)
  return (
    <GamePage title="Read the Tape" how={mode === 'read' ? 'Where is the red arrow pointing? Count the big inch marks, then the little marks after them.' : 'Find the measurement on the tape and tap right on its mark.'}>
      <div className="mb-4 flex flex-wrap gap-2">
        {TAPE_LEVELS.map((l, i) => <button key={l.den} aria-pressed={level === i} onClick={() => restart(i)} className={`rounded-xl px-4 py-2 text-lg font-semibold ${level === i ? 'bg-sky-600 text-white' : 'bg-white'}`}>{l.label}</button>)}
        <span className="mx-2" />
        <button aria-pressed={mode === 'read'} onClick={() => restart(level, 'read')} className={`rounded-xl px-4 py-2 text-lg ${mode === 'read' ? 'bg-amber-500 text-white' : 'bg-white'}`}>Read it</button>
        <button aria-pressed={mode === 'find'} onClick={() => restart(level, 'find')} className={`rounded-xl px-4 py-2 text-lg ${mode === 'find' ? 'bg-amber-500 text-white' : 'bg-white'}`}>Find it</button>
      </div>
      {round.done && !answered ? <RoundEnd right={round.right} onAgain={() => restart()} /> : <>
        <p className="mb-2 text-lg text-sky-800">Question {Math.min(round.asked + (answered ? 0 : 1), 10)} of 10</p>
        {mode === 'find' && <p className="mb-2 flex items-center gap-3 text-3xl font-bold">Find {tapeText(q.answer)} <ReadAloud text={`Find ${speakInches(q.answer)}`} /></p>}
        <Tape den={q.den} from={q.den >= 8 ? Math.max(0, Math.min(6, Math.floor(q.answer) - 2)) : 0} at={mode === 'read' || answered ? q.answer : undefined} tapped={tapped}
          onTap={mode === 'find' && !answered ? v => { setTapped(v); round.answer(findOk(q.answer, v, q.den)) } : undefined} />
        {mode === 'read' && (
          <div role="group" aria-label="Choices" className="mt-4 flex flex-wrap gap-3">
            {q.choices.map(c => (
              <button key={c} disabled={answered} onClick={() => { setPicked(c); round.answer(c === q.answer) }}
                className={`min-w-28 rounded-2xl px-6 py-4 text-2xl font-bold shadow ${answered && c === q.answer ? 'bg-green-500 text-white' : answered && c === picked ? 'bg-amber-400' : 'bg-white hover:bg-sky-100'}`}>{tapeText(c)}</button>
            ))}
          </div>
        )}
        {answered && <Feedback ok={ok} onNext={next} say={`${ok ? 'Right!' : `It's ${speakInches(q.answer)}.`} ${explainTape(q.answer, q.den)}.`}>{ok ? 'Right! ' : `It's ${tapeText(q.answer)}. `}{explainTape(q.answer, q.den)}.</Feedback>}
      </>}
    </GamePage>
  )
}
