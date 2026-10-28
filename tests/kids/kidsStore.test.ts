// @vitest-environment jsdom
import { createKidsStore } from '../../src/kids/kidsStore'
import { newProgress, type Progress } from '../../src/kids/progress'

function fakeAa(start: Progress = newProgress()) {
  const saved: Progress[] = []
  ;(window as any).aa = {
    kidsLoad: async () => ({ progress: structuredClone(start), notice: null }),
    kidsSave: async (p: Progress) => { saved.push(structuredClone(p)) },
    kidsPinIsSet: async () => true,
    kidsSetPin: async () => {},
    kidsCheckPin: async (pin: string) => pin === '1234'
  }
  return saved
}

test('loading brings in saved progress', async () => {
  fakeAa({ ...newProgress(), childName: 'Sam' })
  const k = createKidsStore()
  await k.getState().load()
  expect(k.getState().loaded).toBe(true)
  expect(k.getState().progress.childName).toBe('Sam')
})

test('passing a quiz records today and saves', async () => {
  const saved = fakeAa()
  const k = createKidsStore()
  await k.getState().load()
  await k.getState().passQuiz('quiz-1')
  expect(k.getState().progress.passedQuizzes['quiz-1']).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  expect(saved.at(-1)!.passedQuizzes['quiz-1']).toBeDefined()
})

test('a wrong PIN confirms nothing', async () => {
  const saved = fakeAa({ ...newProgress(), passedQuizzes: { 'quiz-1': '2026-10-28' } })
  const k = createKidsStore()
  await k.getState().load()
  expect(await k.getState().confirmBuilt('pencil-holder', '0000')).toBe(false)
  expect(k.getState().progress.builtProjects).toEqual({})
  expect(saved).toEqual([])
})

test('the right PIN on an unlocked project records it as built', async () => {
  const saved = fakeAa({ ...newProgress(), passedQuizzes: { 'quiz-1': '2026-10-28' } })
  const k = createKidsStore()
  await k.getState().load()
  expect(await k.getState().confirmBuilt('pencil-holder', '1234')).toBe(true)
  expect(k.getState().progress.builtProjects['pencil-holder'].date).toMatch(/^\d{4}-/)
  expect(saved).toHaveLength(1)
})

test('a locked project cannot be marked as built, even with the right PIN', async () => {
  fakeAa()
  const k = createKidsStore()
  await k.getState().load()
  expect(await k.getState().confirmBuilt('pencil-holder', '1234')).toBe(false)
  expect(k.getState().progress.builtProjects).toEqual({})
})

test('the tier changes only with the right PIN', async () => {
  fakeAa()
  const k = createKidsStore()
  await k.getState().load()
  expect(await k.getState().setTier('advanced', '9999')).toBe(false)
  expect(k.getState().progress.tier).toBe('intermediate')
  expect(await k.getState().setTier('advanced', '1234')).toBe(true)
  expect(k.getState().progress.tier).toBe('advanced')
})

test('resetting a quiz needs the PIN and removes the pass', async () => {
  fakeAa({ ...newProgress(), passedQuizzes: { 'quiz-1': '2026-10-28' } })
  const k = createKidsStore()
  await k.getState().load()
  expect(await k.getState().resetQuiz('quiz-1', '1234')).toBe(true)
  expect(k.getState().progress.passedQuizzes).toEqual({})
})

test('finishing a lesson is remembered once', async () => {
  const saved = fakeAa()
  const k = createKidsStore()
  await k.getState().load()
  await k.getState().markLessonOpened('shop-rules')
  await k.getState().markLessonOpened('shop-rules')
  expect(k.getState().progress.openedLessons).toEqual(['shop-rules'])
  expect(saved).toHaveLength(1)
})
