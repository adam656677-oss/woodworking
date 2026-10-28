// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { LESSONS, QUIZZES } from '../../src/kids/content'
import { kids } from '../../src/kids/kidsStore'
import { newProgress, type Progress } from '../../src/kids/progress'
import { LessonView } from '../../src/kids/ui/LessonView'
import { PathView } from '../../src/kids/ui/PathView'
import { ProjectPage } from '../../src/kids/ui/ProjectPage'
import { QuizView } from '../../src/kids/ui/QuizView'

vi.mock('../../src/kids/ui/ProjectViewer', () => ({ ProjectViewer: () => <div data-testid="viewer" /> }))

function setProgress(p: Partial<Progress> = {}) {
  const saved: Progress[] = []
  ;(window as any).aa = { kidsSave: async (x: Progress) => { saved.push(x) }, kidsCheckPin: async (pin: string) => pin === '1234' }
  kids.setState({ loaded: true, progress: { ...newProgress(), ...p }, page: { name: 'home' } })
  return saved
}

afterEach(cleanup)

test('My Path: level 2 is locked until the level 1 quiz is passed', () => {
  setProgress()
  const { unmount } = render(<PathView />)
  expect(within(screen.getByRole('region', { name: 'Level 2: Builder' })).getByText(/Locked/)).toBeTruthy()
  unmount()
  setProgress({ passedQuizzes: { 'quiz-1': '2026-10-28' } })
  render(<PathView />)
  expect(within(screen.getByRole('region', { name: 'Level 2: Builder' })).queryByText(/Locked/)).toBeNull()
})

function answerQuiz(rightCount: number) {
  // The quiz is shuffled; find the right answer by its text.
  const quiz = QUIZZES['quiz-1']
  for (let i = 0; i < quiz.questions.length; i++) {
    const prompt = screen.getByTestId('quiz-prompt').textContent!
    const q = quiz.questions.find(x => x.prompt === prompt)!
    const right = q.choices[q.correct]
    const wrong = q.choices.find(c => c !== right)!
    fireEvent.click(screen.getByRole('button', { name: i < rightCount ? right : wrong }))
    fireEvent.click(screen.getByRole('button', { name: i === quiz.questions.length - 1 ? 'See my score' : 'Next question' }))
  }
}

test('Quiz: 7 of 8 right passes and is recorded', async () => {
  setProgress()
  render(<QuizView id="quiz-1" />)
  answerQuiz(7)
  expect(screen.getByText('You passed!')).toBeTruthy()
  await vi.waitFor(() => expect(kids.getState().progress.passedQuizzes['quiz-1']).toBeDefined())
})

test('Quiz: 6 of 8 right is a try-again and records nothing', () => {
  setProgress()
  render(<QuizView id="quiz-1" />)
  answerQuiz(6)
  expect(screen.getByText(/Try again — you need 7 to pass/)).toBeTruthy()
  expect(kids.getState().progress.passedQuizzes).toEqual({})
})

test('Quiz: each answer shows why', () => {
  setProgress()
  render(<QuizView id="quiz-1" />)
  const prompt = screen.getByTestId('quiz-prompt').textContent!
  const q = QUIZZES['quiz-1'].questions.find(x => x.prompt === prompt)!
  fireEvent.click(screen.getByRole('button', { name: q.choices[q.correct] }))
  expect(screen.getByText(q.reason)).toBeTruthy()
})

test('Project page: locked until its level quiz is passed', () => {
  setProgress()
  const { unmount } = render(<ProjectPage id="pencil-holder" />)
  expect((screen.getByRole('button', { name: 'Print project sheet' }) as HTMLButtonElement).disabled).toBe(true)
  expect((screen.getByRole('button', { name: 'Mark as built' }) as HTMLButtonElement).disabled).toBe(true)
  expect(screen.getByText('Pass the Level 1 quiz to unlock')).toBeTruthy()
  unmount()
  setProgress({ passedQuizzes: { 'quiz-1': '2026-10-28' } })
  render(<ProjectPage id="pencil-holder" />)
  expect((screen.getByRole('button', { name: 'Print project sheet' }) as HTMLButtonElement).disabled).toBe(false)
})

test('Project page: "Adult does this" follows the child tier', () => {
  setProgress({ tier: 'beginner' })
  const { unmount } = render(<ProjectPage id="toolbox" />)
  const drillStep = screen.getByText('Drill pilot holes through the ends.').closest('li')!
  expect(within(drillStep).getByText('Adult does this')).toBeTruthy()
  unmount()
  setProgress({ tier: 'intermediate' })
  render(<ProjectPage id="toolbox" />)
  expect(within(screen.getByText('Drill pilot holes through the ends.').closest('li')!).queryByText('Adult does this')).toBeNull()
})

test('Project page shows the cut sheet from the real design', () => {
  setProgress()
  render(<ProjectPage id="picture-frame" />)
  const table = screen.getByRole('table', { name: 'Cut sheet' })
  expect(within(table).getByText('11-1/2"')).toBeTruthy()
  expect(within(table).getByText('4-1/2"')).toBeTruthy()
})

test('Lesson: reaching the last card remembers the lesson', async () => {
  setProgress()
  const lesson = LESSONS['shop-rules']
  render(<LessonView id="shop-rules" back="path" />)
  for (let i = 1; i < lesson.cards.length; i++) fireEvent.click(screen.getByRole('button', { name: 'Next →' }))
  await vi.waitFor(() => expect(kids.getState().progress.openedLessons).toEqual(['shop-rules']))
})

import { LearnView } from '../../src/kids/ui/LearnView'
import { PinPrompt } from '../../src/kids/ui/PinPrompt'

test('Learn includes the safety and first aid pages', () => {
  setProgress()
  render(<LearnView />)
  expect(screen.getByRole('button', { name: /First aid basics/ })).toBeTruthy()
  expect(screen.getByRole('button', { name: /Safety gear/ })).toBeTruthy()
})

test('with no parent PIN set yet, the PIN prompt says to set one instead of "wrong PIN"', async () => {
  ;(window as any).aa = { kidsPinIsSet: async () => false }
  render(<PinPrompt title="Did you build it?" onSubmit={async () => false} onDone={() => {}} />)
  expect(await screen.findByText(/Set a parent PIN first/)).toBeTruthy()
  expect(screen.queryByLabelText('PIN')).toBeNull()
})
