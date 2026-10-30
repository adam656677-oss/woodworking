import { FINISHES, finishById, hoursText } from '../../src/finish/finishes'
import { canGoOver } from '../../src/finish/compat'
import { rankFinishes } from '../../src/finish/select'
import { checkSchedule, fromTemplate, scheduleTime, setSchedule, stepText, TEMPLATES } from '../../src/finish/schedule'
import { LESSONS } from '../../src/finish/lessons'
import { MOHAWK_FAMILIES, MOHAWK_LINKS } from '../../src/finish/mohawk'
import { kidFinish } from '../../src/finish/kids'
import { deserialize, serialize } from '../../src/model/fileFormat'
import { emptyProject } from '../../src/model/woods'
import { applyTemplate } from '../../src/templates'
import { stepsFromDesign, stepsFromKid } from '../../src/shop/steps'
import { findProject, checkContent } from '../../src/kids/content'

test('finish data: about 20 finishes, unique ids, ratings 0–5, times sensible', () => {
  expect(FINISHES.length).toBeGreaterThanOrEqual(20)
  expect(new Set(FINISHES.map(f => f.id)).size).toBe(FINISHES.length)
  for (const f of FINISHES) {
    for (const k of ['durability', 'water', 'heat', 'solvent', 'repair', 'ease', 'smell'] as const) expect(f[k]).toBeGreaterThanOrEqual(0), expect(f[k]).toBeLessThanOrEqual(5)
    expect(f.recoat).toBeGreaterThanOrEqual(f.touch)
    expect(f.methods.length).toBeGreaterThan(0)
    if (f.role === 'topcoat') expect(f.durability).toBeGreaterThan(0)
    if (f.base === 'oil' || f.base === 'oil-varnish' || f.base === 'varnish') expect(f.rags).toBe(true)
  }
  expect(hoursText(0.5)).toBe('30 min')
  expect(hoursText(12)).toBe('12 hours')
  expect(hoursText(72)).toBe('3 days')
})

test('compatibility: the rules from the spec', () => {
  for (const f of FINISHES) if (f.base !== 'wax' && f.base !== 'non-drying' && f.id !== 'hardwax') expect(canGoOver('shellac', f.id).answer).toBe('yes')
  expect(canGoOver('oil-poly', 'blo')).toMatchObject({ answer: 'yes' })
  expect(canGoOver('oil-poly', 'blo').wait).toMatch(/cured/)
  expect(canGoOver('nitro', 'oil-stain')).toMatchObject({ answer: 'yes' })
  expect(canGoOver('nitro', 'oil-stain').wait).toMatch(/completely dry/)
  expect(canGoOver('water-poly', 'blo').answer).toBe('barrier')
  expect(canGoOver('water-poly', 'oil-stain').answer).toBe('barrier')
  expect(canGoOver('nitro', 'oil-poly').answer).toBe('no')
  expect(canGoOver('oil-poly', 'paste-wax').answer).toBe('no')
  expect(canGoOver('shellac', 'paste-wax').answer).toBe('no')
  expect(canGoOver('paste-wax', 'nitro').answer).toBe('yes')
  expect(canGoOver('water-poly', 'mineral-oil').answer).toBe('no')
  expect(canGoOver('postcat', 'shellac').answer).toBe('no')
  // Every pair gets an answer with a reason.
  for (const a of FINISHES) for (const b of FINISHES) expect(canGoOver(a.id, b.id).why.length).toBeGreaterThan(5)
})

test('selector: food-safe and wipe-only leaves no lacquers; tough + water puts polyurethane first', () => {
  const food = rankFinishes(['food', 'easy'], ['wipe'])
  expect(food.every(r => r.finish.food !== 'no' && r.finish.methods.includes('wipe'))).toBe(true)
  expect(food[0].finish.food).toBe('yes')
  const tough = rankFinishes(['durable', 'water'], ['brush', 'wipe'])
  expect(tough[0].finish.id).toBe('oil-poly')
  expect(tough[0].reasons).toContain('Very tough')
  const clear = rankFinishes(['clear', 'smell'], ['brush'])
  expect(clear[0].finish.ambers).toBe(false)
  expect(rankFinishes(['durable'], ['spray'])[0].finish.id).toBe('postcat')
})

test('templates are clean; a bad order is flagged; totals add up', () => {
  for (const t of TEMPLATES) expect(checkSchedule(fromTemplate(t.id))).toEqual([])
  const s = fromTemplate('wipe-poly')
  expect(scheduleTime(s).hours).toBe(16)
  expect(scheduleTime(s).cureDays).toBe(30)
  const bad = { ...s, steps: [...s.steps, { ...s.steps[1], id: 'x', finishId: 'nitro', title: 'Spray lacquer' }] }
  const issues = checkSchedule(bad)
  expect(issues).toHaveLength(1)
  expect(issues[0]).toMatchObject({ stepId: 'x', level: 'error' })
  const wb = fromTemplate('waterborne')
  const swapped = { ...wb, steps: [wb.steps[0], { ...wb.steps[3], id: 'y', finishId: 'water-poly' }, { ...wb.steps[2], id: 'z', finishId: 'blo' }, { ...wb.steps[3], id: 'w' }] }
  expect(checkSchedule(swapped).some(q => q.level === 'warn' && q.stepId === 'w')).toBe(true)
  expect(stepText(fromTemplate('oil-wax').steps[1])).toMatch(/Oily rags/)
})

test('a schedule round-trips through the project file; a damaged one is dropped', () => {
  const p = setSchedule(emptyProject('T'), fromTemplate('shellac'))
  const q = deserialize(serialize(p))
  expect(q.finish).toEqual(p.finish)
  const broken = JSON.parse(serialize(p))
  broken.finish.steps[0].coats = 'two'
  expect(deserialize(JSON.stringify(broken)).finish!.steps.length).toBe(p.finish!.steps.length - 1)
  broken.finish = 'oil'
  expect(deserialize(JSON.stringify(broken)).finish).toBeUndefined()
})

test('Shop Mode gets the finishing steps after assembly', () => {
  const { template: _t, ...p0 } = applyTemplate(emptyProject('T'), 'bookshelf', {})
  const p = setSchedule(p0, fromTemplate('waterborne'))
  const steps = stepsFromDesign(p)
  const fin = steps.filter(s => s.key.startsWith('finish:'))
  expect(fin.map(s => s.title)).toEqual(p.finish!.steps.map(s => `Finish: ${s.title}`))
  expect(steps.indexOf(fin[0])).toBeGreaterThan(steps.findIndex(s => s.key === 'final'))
})

test('lessons cover the spec topics; Mohawk links are https on their site', () => {
  for (const id of ['prep', 'raise-grain', 'grain-filling', 'sealing', 'colourants', 'glazes-toners', 'colour-matching', 'oils', 'wax', 'shellac', 'lacquer', 'catalysed', 'varnish', 'waterborne', 'application', 'sheen', 'rubbing-out', 'times', 'food-safe', 'safety', 'damage', 'fillers', 'colour-repair', 'care'])
    expect(LESSONS.find(l => l.id === id)?.cards.length).toBeGreaterThan(0)
  for (const l of [...MOHAWK_FAMILIES.map(f => f.url), ...MOHAWK_LINKS.map(x => x.url)]) {
    const u = new URL(l)
    expect(u.protocol).toBe('https:')
    expect(u.hostname).toBe('www.mohawk-finishing.com')
  }
})

test('kids: the sampler is in the content and checks clean; projects get a finishing schedule with sprays for grown-ups', () => {
  expect(checkContent()).toEqual([])
  expect(kidFinish(findProject('finish-sampler')!)).toBeNull()
  expect(kidFinish(findProject('birdhouse')!)!.name).toMatch(/Outdoor/)
  const steps = stepsFromKid(findProject('pencil-holder')!, 'beginner')
  expect(steps.at(-1)!.adult).toBe(true)
  expect(steps.some(s => s.title === 'Finish 1')).toBe(true)
  expect(finishById('shellac')!.food).toBe('cured')
})
