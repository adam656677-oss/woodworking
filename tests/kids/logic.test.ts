import { findProject, QUIZZES } from '../../src/kids/content'
import { adultDoes, badges, levelOpen, newProgress, passMark, projectUnlocked, scoreQuiz, shuffleQuiz } from '../../src/kids/logic'

const quiz8 = QUIZZES['quiz-1']
const rightAnswers = quiz8.questions.map(q => q.correct)
const withWrong = (n: number) => rightAnswers.map((a, i) => (i < n ? (a + 1) % quiz8.questions[i].choices.length : a))

test('the pass mark is 80%, rounded up to whole questions', () => {
  expect([5, 6, 7, 8].map(passMark)).toEqual([4, 5, 6, 7])
})

test('6 of 8 fails and 7 of 8 passes', () => {
  expect(scoreQuiz(withWrong(2), quiz8)).toEqual({ correct: 6, total: 8, passed: false })
  expect(scoreQuiz(withWrong(1), quiz8)).toEqual({ correct: 7, total: 8, passed: true })
})

test('shuffling keeps every right answer attached to its question', () => {
  let seed = 7
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  const s = shuffleQuiz(quiz8, rand)
  expect(s.questions.map(q => q.prompt).sort()).toEqual(quiz8.questions.map(q => q.prompt).sort())
  for (const q of s.questions) {
    const orig = quiz8.questions.find(o => o.prompt === q.prompt)!
    expect(q.choices[q.correct]).toBe(orig.choices[orig.correct])
    expect([...q.choices].sort()).toEqual([...orig.choices].sort())
  }
  expect(s.questions.map(q => q.prompt)).not.toEqual(quiz8.questions.map(q => q.prompt))
})

test('level 1 is always open; level 2 opens when the level 1 quiz is passed', () => {
  const p = newProgress()
  expect(levelOpen(1, p)).toBe(true)
  expect(levelOpen(2, p)).toBe(false)
  p.passedQuizzes['quiz-1'] = '2026-10-28'
  expect(levelOpen(2, p)).toBe(true)
  expect(levelOpen(3, p)).toBe(false)
})

test('a project unlocks when its level quiz is passed', () => {
  const p = newProgress()
  const ph = findProject('pencil-holder')!
  expect(projectUnlocked(ph, p)).toBe(false)
  p.passedQuizzes['quiz-1'] = '2026-10-28'
  expect(projectUnlocked(ph, p)).toBe(true)
  expect(projectUnlocked(findProject('birdhouse')!, p)).toBe(false)
})

test('"Adult does this" follows the tool tier against the child tier', () => {
  expect(adultDoes('jigsaw', 'intermediate')).toBe(false)
  expect(adultDoes('jigsaw', 'beginner')).toBe(true)
  expect(adultDoes('table-saw', 'advanced')).toBe(true)
  expect(adultDoes('hammer', 'beginner')).toBe(false)
  expect(adultDoes(undefined, 'beginner')).toBe(false)
  expect(adultDoes('no-such-tool', 'advanced')).toBe(false)
})

test('a fresh start: intermediate tier, nothing earned', () => {
  expect(newProgress()).toEqual({ formatVersion: 1, childName: '', tier: 'intermediate', passedQuizzes: {}, openedLessons: [], builtProjects: {} })
})

test('badges: one per passed level quiz, one per parent-confirmed project, nothing else', () => {
  const p = newProgress()
  p.passedQuizzes['quiz-1'] = '2026-10-28'
  p.openedLessons.push('shop-rules')
  expect(badges(p)).toEqual([{ kind: 'level', id: 'level-1', name: 'Sawdust Starter', date: '2026-10-28' }])
  p.builtProjects['pencil-holder'] = { date: '2026-10-29' }
  expect(badges(p)).toEqual([
    { kind: 'level', id: 'level-1', name: 'Sawdust Starter', date: '2026-10-28' },
    { kind: 'project', id: 'project-pencil-holder', name: 'Pencil holder', date: '2026-10-29' }
  ])
})
