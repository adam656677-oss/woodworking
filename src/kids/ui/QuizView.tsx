import { useMemo, useState } from 'react'
import { LEVELS, QUIZZES } from '../content'
import { passMark, scoreQuiz, shuffleQuiz } from '../logic'
import { kids } from '../kidsStore'
import { KidsPageFrame } from './kit'
import { ReadAloud } from './ReadAloud'

/** One question at a time; each answer shows why; 80% passes and earns the level badge. */
export function QuizView({ id }: { id: string }) {
  const original = QUIZZES[id]
  const [attempt, setAttempt] = useState(0)
  const quiz = useMemo(() => shuffleQuiz(original, Math.random), [original, attempt])
  const [i, setI] = useState(0)
  const [answers, setAnswers] = useState<number[]>([])
  const [finished, setFinished] = useState(false)
  const level = LEVELS.find(l => l.quiz === id)
  const q = quiz.questions[i]
  const picked = answers[i]

  const restart = () => {
    setAttempt(a => a + 1)
    setI(0)
    setAnswers([])
    setFinished(false)
  }

  if (finished) {
    const r = scoreQuiz(answers, quiz)
    return (
      <KidsPageFrame title={`Level ${level?.id} quiz`} back={{ name: 'path' }}>
        <div className="mx-auto max-w-2xl rounded-3xl bg-white p-10 text-center shadow">
          <p className="text-3xl">You got {r.correct} of {r.total} right.</p>
          {r.passed ? (
            <>
              <p className="mt-4 text-5xl font-bold text-green-700">You passed!</p>
              <p className="mt-3 text-2xl">You earned the {level?.name} badge. Its projects are unlocked.</p>
              <button onClick={() => kids.getState().go({ name: 'projects' })} className="mt-6 rounded-xl bg-amber-600 px-6 py-3 text-xl font-semibold text-white">See the projects →</button>
            </>
          ) : (
            <>
              <p className="mt-4 text-3xl font-bold text-amber-700">Try again — you need {passMark(r.total)} to pass.</p>
              <p className="mt-2 text-xl">Look back at the lessons if you want. The questions come in a new order.</p>
              <button onClick={restart} className="mt-6 rounded-xl bg-sky-600 px-6 py-3 text-xl font-semibold text-white">Try again</button>
            </>
          )}
        </div>
      </KidsPageFrame>
    )
  }

  const choose = (c: number) => {
    if (picked !== undefined) return
    const next = [...answers]
    next[i] = c
    setAnswers(next)
  }
  const isLast = i === quiz.questions.length - 1
  const goOn = () => {
    if (!isLast) {
      setI(i + 1)
      return
    }
    setFinished(true)
    if (scoreQuiz(answers, quiz).passed) void kids.getState().passQuiz(id)
  }

  return (
    <KidsPageFrame title={`Level ${level?.id} quiz`} back={{ name: 'path' }}>
      <div className="mx-auto max-w-3xl rounded-3xl bg-white p-8 shadow">
        <p className="text-lg text-stone-500">Question {i + 1} of {quiz.questions.length}</p>
        <div className="mt-2 flex items-start gap-4">
          <h2 data-testid="quiz-prompt" className="flex-1 text-3xl font-bold">{q.prompt}</h2>
          <ReadAloud text={`${q.prompt} ${q.choices.join('. ')}`} />
        </div>
        <div className="mt-6 flex flex-col gap-3">
          {q.choices.map((c, k) => {
            const state = picked === undefined ? '' : k === q.correct ? 'border-green-600 bg-green-100' : k === picked ? 'border-red-500 bg-red-100' : 'opacity-60'
            return (
              <button key={k} onClick={() => choose(k)} className={`rounded-2xl border-4 border-sky-200 p-4 text-left text-2xl hover:bg-sky-50 ${state}`}>{c}</button>
            )
          })}
        </div>
        {picked !== undefined && (
          <div className="mt-6">
            <p className={`text-2xl font-bold ${picked === q.correct ? 'text-green-700' : 'text-red-700'}`}>{picked === q.correct ? 'Right!' : `Not quite — it's “${q.choices[q.correct]}”.`}</p>
            <p className="mt-1 text-xl">{q.reason}</p>
            <button onClick={goOn} className="mt-4 rounded-xl bg-sky-600 px-6 py-3 text-xl font-semibold text-white">{isLast ? 'See my score' : 'Next question'}</button>
          </div>
        )}
      </div>
    </KidsPageFrame>
  )
}
