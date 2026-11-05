import { searchTopics } from '../../src/help/search'
import type { HelpTopic } from '../../src/help/types'

const t = (id: string, title: string, extra: Partial<HelpTopic> = {}): HelpTopic => ({
  id, group: 'Test', title, summary: '', keywords: [], steps: ['Do it.'], labels: [], ...extra
})
const topics = [
  t('a', 'Start from a template', { keywords: ['new', 'box'] }),
  t('b', 'Print a cut list', { summary: 'Shopping and cutting', steps: ['Press **Cut List**.'], labels: ['Cut List'] }),
  t('c', 'Save your work', { keywords: ['autosave', 'recover'] })
]

it('returns every topic, in order, for an empty search', () => {
  expect(searchTopics(topics, '').map(x => x.id)).toEqual(['a', 'b', 'c'])
  expect(searchTopics(topics, '   ').map(x => x.id)).toEqual(['a', 'b', 'c'])
})

it('finds topics by title, keyword, summary and step words, ignoring case', () => {
  expect(searchTopics(topics, 'TEMPLATE').map(x => x.id)).toEqual(['a'])
  expect(searchTopics(topics, 'autosave').map(x => x.id)).toEqual(['c'])
  expect(searchTopics(topics, 'shopping').map(x => x.id)).toEqual(['b'])
  expect(searchTopics(topics, 'press').map(x => x.id)).toEqual(['b'])
})

it('needs every word to match somewhere in the topic', () => {
  expect(searchTopics(topics, 'cut list').map(x => x.id)).toEqual(['b'])
  expect(searchTopics(topics, 'cut banana')).toEqual([])
})

it('ranks a title match above a step-only match', () => {
  const list = [t('x', 'Something else', { steps: ['Open the cut list.'] }), t('y', 'The cut list')]
  expect(searchTopics(list, 'cut list').map(x => x.id)).toEqual(['y', 'x'])
})

it('matches the start of a word, so "templ" finds "template"', () => {
  expect(searchTopics(topics, 'templ').map(x => x.id)).toEqual(['a'])
})

it('does not trip over punctuation or marks around the search words', () => {
  expect(searchTopics(topics, 'cut-list?').map(x => x.id)).toEqual(['b'])
  expect(searchTopics(topics, '**cut**').map(x => x.id)).toEqual(['b'])
})
