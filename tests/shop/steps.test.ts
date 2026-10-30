import { applyTemplate } from '../../src/templates'
import { emptyProject } from '../../src/model/woods'
import { addMinutes, emptyProgress, jointStep, stepsFromDesign, stepsFromPlan, toggleDone } from '../../src/shop/steps'
import { groupBoards } from '../../src/assemblies/ops'

test('a bookshelf gives: cut the parts, one step per dado and rabbet, then final assembly', () => {
  const p = applyTemplate(emptyProject('T'), 'bookshelf', {})
  const steps = stepsFromDesign(p)
  expect(steps[0]).toMatchObject({ key: 'cut', title: 'Cut the parts' })
  expect(steps[0].parts.map(x => x.name)).toContain('Side')
  expect(steps[0].text).toBe(`Cut ${p.boards.length} parts to size. Label each one as you go.`)
  const cuts = steps.filter(s => s.key.startsWith('joint:'))
  expect(cuts).toHaveLength(p.joints.length)
  expect(cuts[0].text).toMatch(/^Cut a dado in Side for (Top|Bottom|Shelf): 1\/4" wide|^Cut a dado in Side for/)
  expect(steps[steps.length - 1]).toMatchObject({ key: 'final', title: 'Final assembly' })
})

test('groups are assembled inside-out before the final assembly', () => {
  const p0 = applyTemplate(emptyProject('T'), 'box', {})
  const { template: _t, ...p1 } = p0
  const ids = p1.boards.map(b => b.id)
  const inner = groupBoards(p1, ids.slice(0, 2), 'Pair')
  if ('error' in inner) throw new Error(inner.error)
  const outer = groupBoards(inner.project, ids.slice(0, 3), 'Three')
  if ('error' in outer) throw new Error(outer.error)
  const steps = stepsFromDesign(outer.project)
  const titles = steps.map(s => s.title)
  expect(titles.indexOf('Assemble Pair')).toBeLessThan(titles.indexOf('Assemble Three'))
  expect(titles.indexOf('Assemble Three')).toBeLessThan(titles.indexOf('Final assembly'))
})

test('joint sentences read like bench instructions', () => {
  const p = applyTemplate(emptyProject('T'), 'box', { corners: 'butt' })
  const j = p.joints[0]
  expect(jointStep(p, j).text).toMatch(/^Butt .+ against .+ and fasten with /)
  expect(stepsFromDesign(emptyProject('T'))).toEqual([])
})

test('plan steps and progress', () => {
  const s = stepsFromPlan({ steps: [{ id: 's1', text: 'Sand it', tool: 'Sander' }, { id: 's2', text: 'Glue it' }] })
  expect(s.map(x => [x.key, x.title, x.tools])).toEqual([['s1', 'Step 1', ['Sander']], ['s2', 'Step 2', []]])
  let pr = toggleDone(emptyProgress(), 's1')
  expect(pr.done).toEqual(['s1'])
  pr = addMinutes(addMinutes(pr, 's1', 2.04), 's1', 1)
  expect(pr.minutes.s1).toBe(3)
  expect(toggleDone(pr, 's1').done).toEqual([])
})

test("a plan's steps name their tools and mark what a grown-up does for the child's tier", async () => {
  const { TOOLS } = await import('../../src/kids/content')
  const adultTool = Object.values(TOOLS).find(t => t.tier === 'adult')!
  const plan = { steps: [{ id: 's1', text: 'Sand it', tool: Object.values(TOOLS).find(t => t.tier === 'beginner')!.id }, { id: 's2', text: 'Rip it', tool: adultTool.id }] }
  const grown = stepsFromPlan(plan)
  expect(grown[1].tools).toEqual([adultTool.name])
  expect(grown.some(s => s.adult)).toBe(false)
  const kid = stepsFromPlan(plan, 'beginner')
  expect(kid.map(s => !!s.adult)).toEqual([false, true])
})

test("a kids' project gives its own steps with Adult does this marks", async () => {
  const { stepsFromKid } = await import('../../src/shop/steps')
  const { PROJECTS } = await import('../../src/kids/content')
  const proj = PROJECTS[0]
  const steps = stepsFromKid(proj, 'beginner')
  expect(steps.map(s => s.text)).toEqual(proj.steps.map(s => s.text))
  expect(steps[0].key).toBe(`${proj.id}:0`)
})
