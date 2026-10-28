import { LESSONS, LEVELS, QUIZZES } from '../content'
import { levelOpen, passMark } from '../logic'
import { kids, useKids } from '../kidsStore'
import { Art } from '../art'
import { KidsPageFrame } from './kit'

/** The four levels as a trail: lessons to read, then the level quiz. */
export function PathView() {
  const progress = useKids(s => s.progress)
  const k = kids.getState()
  return (
    <KidsPageFrame title="My Path">
      <ol className="mx-auto flex max-w-4xl flex-col gap-6">
        {LEVELS.map(lv => {
          const open = levelOpen(lv.id, progress)
          const passed = lv.quiz in progress.passedQuizzes
          const quiz = QUIZZES[lv.quiz]
          return (
            <li key={lv.id}>
              <section aria-label={`Level ${lv.id}: ${lv.name}`} className={`rounded-3xl border-4 bg-white p-5 shadow ${open ? 'border-green-400' : 'border-stone-300 opacity-70'}`}>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-2xl font-bold">Level {lv.id}: {lv.name} {passed && <span className="ml-2 rounded-full bg-green-600 px-3 py-1 text-base text-white">Badge earned ✓</span>}</h2>
                  {!open && <span className="text-lg text-stone-600">🔒 Locked — pass Level {lv.id - 1} first</span>}
                </div>
                <ul className="grid grid-cols-2 gap-3">
                  {lv.lessons.map(id => {
                    const l = LESSONS[id]
                    const done = progress.openedLessons.includes(id)
                    return (
                      <li key={id}>
                        <button disabled={!open} onClick={() => k.go({ name: 'lesson', id, card: 0, back: 'path' })} className="flex w-full items-center gap-3 rounded-xl border-2 border-sky-200 bg-sky-50 p-3 text-left text-lg hover:bg-sky-100 disabled:cursor-not-allowed">
                          <Art name={l.cards[0].image} className="block h-10 w-10 shrink-0" />
                          <span className="flex-1">{l.title}</span>
                          {done && <span aria-label="done" className="text-green-600">✓</span>}
                        </button>
                      </li>
                    )
                  })}
                </ul>
                <button disabled={!open} onClick={() => k.go({ name: 'quiz', id: lv.quiz })} className="mt-4 rounded-xl bg-amber-600 px-5 py-2 text-lg font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50">
                  {passed ? 'Take the quiz again' : `Take the Level ${lv.id} quiz`} <span className="text-sm font-normal">({quiz.questions.length} questions, pass with {passMark(quiz.questions.length)})</span>
                </button>
              </section>
            </li>
          )
        })}
      </ol>
    </KidsPageFrame>
  )
}
