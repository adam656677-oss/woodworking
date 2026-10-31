import { checkPlan, planToProject, scalePlan, stockFor } from '../../src/smart/plan'
import { checkWoodAnswer } from '../../src/smart/wood'
import { checkDescribeAnswer, matchTemplate } from '../../src/smart/describe'
import { ClapDetector } from '../../src/smart/listen'
import { emptyProject } from '../../src/model/woods'
import { validate } from '../../src/model/validate'
import { worldBox } from '../../src/model/geometry'

// A small stool as a helper might describe it (in made-up units: everything half size).
const stool = {
  name: 'Stool',
  steps: ['Cut the legs', 'Screw on the top'],
  parts: [
    { name: 'Top', width: 6, length: 6, thickness: 0.4, x: 0, y: 0, z: 8.6, lies: 'flat-x' },
    { name: 'Leg', width: 1.75, length: 8.6, thickness: 0.4, x: 0, y: 0, z: 0, lies: 'upright-x' },
    { name: 'Leg', width: 1.75, length: 8.6, thickness: 0.4, x: 4.25, y: 0, z: 0, lies: 'upright-x' }
  ]
}

test('a helper plan is checked: bad parts and too many parts are refused', () => {
  expect('error' in checkPlan({})).toBe(true)
  expect('error' in checkPlan({ parts: [] })).toBe(true)
  expect('error' in checkPlan({ parts: [{ ...stool.parts[0], width: -3 }] })).toBe(true)
  expect('error' in checkPlan({ parts: [{ ...stool.parts[0], lies: 'sideways' }] })).toBe(true)
  expect('error' in checkPlan({ parts: Array(61).fill(stool.parts[0]) })).toBe(true)
  const ok = checkPlan(stool)
  expect('error' in ok).toBe(false)
})

test('scaled to the known measurement, snapped to stock, built as a design', () => {
  const plan = checkPlan(stool)
  if ('error' in plan) throw new Error(plan.error)
  const scaled = scalePlan(plan, { dim: 'height', value: 18 })
  const p = planToProject(scaled)
  const zs = p.boards.map(worldBox)
  const top = Math.max(...zs.map(b => b.max.z)), bottom = Math.min(...zs.map(b => b.min.z))
  // The height comes out within a stock-thickness rounding of 18".
  expect(Math.abs(top - bottom - 18)).toBeLessThan(0.2)
  // 0.8" → 3/4" stock.
  expect(p.boards.every(b => Math.abs(b.thickness - 0.75) < 0.05)).toBe(true)
  expect(validate(p).filter(w => w.kind === 'overlap')).toEqual([])
  expect(stockFor({ width: 20, thickness: 0.72 }, emptyProject('x').woods).kind).toBe('sheet')
})

test('wood answers keep to species in the Library', () => {
  const r = checkWoodAnswer({ guesses: [{ species: 'red-oak', sure: 'likely', look: 'open pores' }, { species: 'Unobtanium' }, { species: 'cherry', sure: 'maybe' }, { species: 'red-oak' }] })
  if ('error' in r) throw new Error(r.error)
  expect(r.map(g => g.species.id)).toEqual(['red-oak', 'black-cherry'])
  expect('error' in checkWoodAnswer({ guesses: [{ species: 'mystery' }] })).toBe(true)
})

test('describe offline: the closest template and the sizes in the words', () => {
  const a = matchTemplate('A bookshelf 30 inches wide and 48" tall with 4 shelves')!
  expect(a.def.id).toBe('bookshelf')
  expect(a.params).toMatchObject({ W: 30, H: 48, shelves: 4 })
  const b = matchTemplate('a little box with a lid, 10 wide')!
  expect(b.def.id).toBe('box')
  expect(b.params).toMatchObject({ W: 10, lid: true })
  expect(matchTemplate('a birdhouse for wrens')!.def.id).toBe('birdhouse')
  expect(matchTemplate('a 3 foot tall bookcase')!.params.H).toBe(36)
  expect(matchTemplate('something nice')).toBeNull()
})

test('describe online: templates checked, plans checked', () => {
  expect(checkDescribeAnswer({ template: 'bookshelf', params: { W: 30, shelves: 2, bogus: 1, wood: 'ply-3-4' } })).toEqual({ template: 'bookshelf', params: { W: 30, shelves: 2, wood: 'ply-3-4' } })
  expect('error' in checkDescribeAnswer({ template: 'spaceship' })).toBe(true)
  expect('plan' in checkDescribeAnswer(stool)).toBe(true)
})

test('hands-free: a clap triggers once; a steady machine noise does not', () => {
  const d = new ClapDetector({ sensitivity: 5, pauseMs: 1500 })
  let t = 0, hits = 0
  const run = (level: number, ms: number) => { for (let k = 0; k < ms / 16; k++) { if (d.feed(level, t)) hits++; t += 16 } }
  run(0.01, 2000)
  run(0.4, 80) // clap
  run(0.01, 300)
  expect(hits).toBe(1)
  run(0.4, 80) // too soon after
  run(0.01, 300)
  expect(hits).toBe(1)
  run(0.01, 1500)
  run(0.3, 6000) // a dust collector starts and runs
  run(0.3, 2000)
  expect(hits).toBe(1)
  run(0.01, 4000) // it stops; quiet again
  run(0.5, 100)
  run(0.01, 300)
  expect(hits).toBe(2)
})
