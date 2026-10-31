// Shared pieces for the kids' games: a page with the instructions read aloud, and a round of questions.
import { useState, type ReactNode } from 'react'
import { KidsPageFrame } from '../../kids/ui/kit'
import { ReadAloud } from '../../kids/ui/ReadAloud'

export function GamePage({ title, how, children }: { title: string; how: string; children: ReactNode }) {
  return (
    <KidsPageFrame title={title} back={{ name: 'games' }} actions={<ReadAloud text={how} />}>
      <p className="mb-4 max-w-3xl text-xl">{how}</p>
      {children}
    </KidsPageFrame>
  )
}

export const ROUND = 10

/** A round of questions: how many asked and how many right. No points kept after the round. */
export function useRound() {
  const [asked, setAsked] = useState(0)
  const [right, setRight] = useState(0)
  return {
    asked, right, done: asked >= ROUND,
    answer: (ok: boolean) => { setAsked(a => a + 1); if (ok) setRight(r => r + 1) },
    again: () => { setAsked(0); setRight(0) }
  }
}

export function RoundEnd({ right, onAgain, extra }: { right: number; onAgain(): void; extra?: ReactNode }) {
  const note = right === ROUND ? 'Every one right — you could teach this!' : right >= ROUND * 0.7 ? 'Great work. A few more tries and you’ll have it down.' : 'Good practice. Try another round — it gets easier every time.'
  return (
    <section role="status" aria-label="Round done" className="flex max-w-xl flex-col items-start gap-3 rounded-2xl bg-white p-6 text-2xl shadow">
      <p className="text-3xl font-bold">{right} of {ROUND} right</p>
      <p>{note}</p>
      {extra}
      <button autoFocus onClick={onAgain} className="rounded-xl bg-green-600 px-6 py-3 text-xl font-semibold text-white hover:bg-green-700">Play again</button>
    </section>
  )
}

/** The right-or-not message after an answer, with a Next button. */
/** Where a pointer is in an SVG's own units (borders and scaling taken care of). */
export function svgPoint(svg: SVGSVGElement, clientX: number, clientY: number): { x: number; y: number } {
  const m = svg.getScreenCTM()
  if (!m) return { x: 0, y: 0 }
  const p = new DOMPoint(clientX, clientY).matrixTransform(m.inverse())
  return { x: p.x, y: p.y }
}

export function Feedback({ ok, children, onNext, say, next = 'Next →' }: { ok: boolean; children: ReactNode; onNext(): void; say?: string; next?: string }) {
  return (
    <div role="alert" className={`mt-4 flex max-w-3xl items-center gap-4 rounded-2xl p-4 text-xl ${ok ? 'bg-green-100 text-green-900' : 'bg-amber-100 text-amber-900'}`}>
      <span className="text-3xl" aria-hidden>{ok ? '✅' : '🤔'}</span>
      <div className="flex-1">{children}</div>
      {say && <ReadAloud text={say} />}
      <button autoFocus onClick={onNext} className="rounded-xl bg-sky-600 px-5 py-2 font-semibold text-white">{next}</button>
    </div>
  )
}
