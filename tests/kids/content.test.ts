import { checkContent, checkContentOf, CONTENT, designFor, LEVELS, PROJECTS, QUIZZES, TOOLS } from '../../src/kids/content'
import { validate } from '../../src/model/validate'

test('the bundled content has no problems', () => {
  expect(checkContent()).toEqual([])
})

test('four levels with their names', () => {
  expect(LEVELS.map(l => l.name)).toEqual(['Sawdust Starter', 'Builder', 'Craftsman', 'Workshop Pro'])
})

test('quiz sizes per level are 8, 6, 6, 6', () => {
  expect(LEVELS.map(l => QUIZZES[l.quiz].questions.length)).toEqual([8, 6, 6, 6])
})

test('the five starter projects, in order', () => {
  expect(PROJECTS.map(p => p.id)).toEqual(['pencil-holder', 'tic-tac-toe', 'birdhouse', 'picture-frame', 'toolbox'])
})

test.each(['pencil-holder', 'tic-tac-toe', 'birdhouse', 'picture-frame', 'toolbox'])('%s builds with no warnings and only butt joints', id => {
  const d = designFor(id)
  expect(d.boards.length).toBeGreaterThan(1)
  expect(validate(d)).toEqual([])
  expect(d.joints.every(j => j.type === 'butt')).toBe(true)
})

test('tool tiers follow the spec table', () => {
  expect(TOOLS['table-saw'].tier).toBe('adult')
  expect(TOOLS['drill'].tier).toBe('intermediate')
  expect(TOOLS['hand-saw'].tier).toBe('beginner')
  expect(TOOLS['brad-nailer'].tier).toBe('advanced')
})

describe('the checker catches broken content', () => {
  const clone = () => structuredClone(CONTENT)
  test('a right answer that is not one of the choices', () => {
    const c = clone()
    c.quizzes['quiz-1'].questions[0].correct = 9
    expect(checkContentOf(c)).toEqual([expect.stringContaining('quiz-1')])
  })
  test('a step that names an unknown tool', () => {
    const c = clone()
    c.projects[0].steps[0].tool = 'chainsaw'
    expect(checkContentOf(c)).toEqual([expect.stringContaining('chainsaw')])
  })
  test('a card picture that does not exist', () => {
    const c = clone()
    const first = Object.keys(c.lessons)[0]
    c.lessons[first].cards[0].image = 'nope'
    expect(checkContentOf(c)).toEqual([expect.stringContaining('nope')])
  })
  test('a level whose quiz is missing', () => {
    const c = clone()
    c.levels[1].quiz = 'quiz-missing'
    expect(checkContentOf(c)).toEqual([expect.stringContaining('quiz-missing')])
  })
})
