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

// ---- Final review fixes ----
import { findProject } from '../../src/kids/content'

test('every wood a project uses is named in its steps (no "cut all the parts from the 1x6" when the roof is a 1x8)', () => {
  for (const p of ['pencil-holder', 'tic-tac-toe', 'birdhouse', 'picture-frame', 'toolbox']) {
    const steps = findProject(p)!.steps.map(s => s.text).join(' ')
    const woods = new Set(designFor(p).boards.map(b => b.woodId))
    for (const w of woods) expect(steps, `${p} never mentions ${w}`).toContain(w)
  }
})

test('every starter part is a size a kid can measure (whole 1/8")', () => {
  for (const p of ['pencil-holder', 'tic-tac-toe', 'birdhouse', 'picture-frame', 'toolbox']) {
    for (const b of designFor(p).boards) {
      if (b.woodId.startsWith('ply')) continue
      expect((b.length * 8) % 1, `${p} ${b.name} length`).toBe(0)
      expect((b.width * 8) % 1, `${p} ${b.name} width`).toBe(0)
    }
  }
})

test('birdhouse: drain holes in the floor and a screwed-on roof that comes off for cleaning', () => {
  const d = designFor('birdhouse')
  const floor = d.boards.find(b => b.name === 'Floor')!
  const roof = d.boards.find(b => b.name === 'Roof')!
  expect(floor.holes.length).toBeGreaterThanOrEqual(4)
  expect(floor.holes.every(h => h.diameter === 0.25)).toBe(true)
  expect(d.joints.filter(j => j.hostBoardId === roof.id).every(j => (j.params as { fastener: string }).fastener === 'screws')).toBe(true)
})

test('picture frame: glued corners with mending plates on the back — no drilling through the rails', () => {
  const p = findProject('picture-frame')!
  expect(p.tools).not.toContain('drill')
  expect(p.steps.some(s => /mending plate/i.test(s.text))).toBe(true)
  expect(designFor('picture-frame').joints.every(j => (j.params as { fastener: string }).fastener === 'glue')).toBe(true)
})

test('toolbox: pilot holes go through the ends (the ends hold the screws)', () => {
  expect(findProject('toolbox')!.steps.map(s => s.text)).toContain('Drill pilot holes through the ends.')
})
