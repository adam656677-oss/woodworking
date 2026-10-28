import { useEffect, useState } from 'react'
import { Art } from '../art'
import { LESSONS, LIBRARY } from '../content'
import { kids } from '../kidsStore'
import { KidsPageFrame } from './kit'
import { ReadAloud } from './ReadAloud'

/** One card at a time: picture, a few sentences, a tip, and read-aloud. */
export function LessonView({ id, back }: { id: string; back: 'path' | 'learn' }) {
  const lesson = LESSONS[id] ?? LIBRARY.find(l => l.id === id)
  const [i, setI] = useState(0)
  const last = lesson ? i === lesson.cards.length - 1 : true
  useEffect(() => {
    if (lesson && last && lesson.level > 0) void kids.getState().markLessonOpened(lesson.id)
  }, [lesson, last])
  if (!lesson) return <KidsPageFrame title="Not found" back={{ name: back }}>That page is missing.</KidsPageFrame>
  const card = lesson.cards[i]
  const spoken = [...card.text, card.tip ? `${card.tip.kind === 'safety' ? 'Safety tip' : 'Try it'}: ${card.tip.text}` : ''].join(' ')
  return (
    <KidsPageFrame title={lesson.title} back={{ name: back }}>
      <article className="mx-auto flex max-w-3xl flex-col items-center gap-6 rounded-3xl bg-white p-8 shadow">
        <Art name={card.image} className="block h-48 w-48" />
        <div className="flex w-full items-start gap-4">
          <div className="flex-1 space-y-3 text-2xl leading-relaxed">
            {card.text.map((t, k) => <p key={k}>{t}</p>)}
          </div>
          <ReadAloud text={spoken} />
        </div>
        {card.tip && (
          <p className={`w-full rounded-2xl border-l-8 p-4 text-xl ${card.tip.kind === 'safety' ? 'border-red-500 bg-red-50' : 'border-green-500 bg-green-50'}`}>
            <strong>{card.tip.kind === 'safety' ? '⚠️ Safety tip: ' : '👍 Try it: '}</strong>
            {card.tip.text}
          </p>
        )}
        <div className="flex w-full items-center justify-between">
          <button disabled={i === 0} onClick={() => setI(i - 1)} className="rounded-xl bg-sky-100 px-5 py-2 text-xl disabled:opacity-30">← Back</button>
          <span className="text-lg text-stone-500">{i + 1} of {lesson.cards.length}</span>
          {last ? (
            <button onClick={() => kids.getState().go({ name: back })} className="rounded-xl bg-green-600 px-5 py-2 text-xl font-semibold text-white">Done ✓</button>
          ) : (
            <button onClick={() => setI(i + 1)} className="rounded-xl bg-sky-600 px-5 py-2 text-xl font-semibold text-white">Next →</button>
          )}
        </div>
      </article>
    </KidsPageFrame>
  )
}
