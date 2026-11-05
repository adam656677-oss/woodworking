import { helpFor } from '../../src/help/context'
import { MASTER_TOPICS } from '../../src/help/topics'
import { KIDS_TOPICS } from '../../src/help/kidsTopics'

it('opens kids help in the Kids\' Workshop and in the Simple Designer', () => {
  expect(helpFor({ screen: 'kids', kidsMode: false }).audience).toBe('kids')
  expect(helpFor({ screen: 'master', kidsMode: true }).audience).toBe('kids')
  expect(helpFor({ screen: 'draw', kidsMode: true }).audience).toBe('kids')
})

it('opens Master Shop help everywhere else', () => {
  for (const screen of ['home', 'master', 'plans', 'draw', 'finish', 'library', 'joints', 'tools'] as const) {
    expect(helpFor({ screen, kidsMode: false }).audience).toBe('master')
  }
})

it('goes straight to the topic for the screen being used', () => {
  expect(helpFor({ screen: 'finish', kidsMode: false }).topicId).toBe('finishing')
  expect(helpFor({ screen: 'plans', kidsMode: false }).topicId).toBe('plans')
  expect(helpFor({ screen: 'draw', kidsMode: false }).topicId).toBe('shaped')
  expect(helpFor({ screen: 'home', kidsMode: false }).topicId).toBeUndefined()
  expect(helpFor({ screen: 'kids', kidsMode: false, kidsPage: 'sheet' }).topicId).toBe('print-sheet')
  expect(helpFor({ screen: 'kids', kidsMode: false, kidsPage: 'games' }).topicId).toBe('games')
  expect(helpFor({ screen: 'master', kidsMode: true }).topicId).toBe('designer')
})

it('only ever names topics that exist', () => {
  const master = new Set(MASTER_TOPICS.map(x => x.id))
  const kids = new Set(KIDS_TOPICS.map(x => x.id))
  const screens = ['home', 'kids', 'master', 'plans', 'draw', 'finish', 'library', 'joints', 'tools'] as const
  const pages = [undefined, 'home', 'path', 'lesson', 'quiz', 'projects', 'project', 'learn', 'badges', 'parent', 'sheet', 'certificate', 'plans', 'calc', 'games', 'game']
  for (const screen of screens) for (const kidsMode of [false, true]) for (const kidsPage of pages) {
    const r = helpFor({ screen, kidsMode, kidsPage })
    if (r.topicId) expect((r.audience === 'kids' ? kids : master).has(r.topicId), `${screen}/${kidsMode}/${kidsPage} -> ${r.topicId}`).toBe(true)
  }
})
