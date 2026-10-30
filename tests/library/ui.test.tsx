// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { Library, openLibrary } from '../../src/library/ui/Library'
import { studio } from '../../src/ui/store'
import { GLOSSARY } from '../../src/library/glossary'
import { ARTICLES } from '../../src/library/reference'

afterEach(cleanup)
beforeEach(() => { ;(window as any).aa = { setDirty: () => {} }; studio.getState().newFromTemplate('bookshelf') })

test('species: search and filters; a page cites its source and warns about dust', () => {
  openLibrary('master')
  render(<Library />)
  fireEvent.change(screen.getByLabelText('Search species'), { target: { value: 'cedar' } })
  const list = screen.getByRole('list', { name: 'Species list' })
  expect(within(list).getAllByRole('listitem').length).toBeGreaterThanOrEqual(3)
  fireEvent.click(within(list).getByText('Western red cedar'))
  const page = screen.getByRole('article', { name: 'Western red cedar' })
  expect(page.textContent).toContain('Wood Handbook')
  expect(within(page).getByRole('note').textContent).toMatch(/asthma/)
  fireEvent.change(screen.getByLabelText('Search species'), { target: { value: '' } })
  fireEvent.click(screen.getByLabelText('Food-safe'))
  expect(within(list).queryByText('Red oak')).toBeNull()
  expect(within(list).getByText('Hard maple')).toBeTruthy()
})

test('the movement calculator opens with values from a warning', () => {
  openLibrary('master', 'movement', { width: 16, speciesId: 'red-oak' })
  render(<Library />)
  expect((screen.getByLabelText('Width') as HTMLInputElement).value).toBe('16"')
  expect(screen.getByRole('status', { name: 'Movement' }).textContent).toMatch(/Grows about 23\/64"/)
})

test('the sag calculator: a 36" pine shelf fails, 3/4" to 1-1/2" passes', () => {
  openLibrary('master', 'sag')
  render(<Library />)
  expect(screen.getByRole('status', { name: 'Sag' }).textContent).toMatch(/Too much sag/)
  fireEvent.change(screen.getByLabelText('Thickness'), { target: { value: '1-1/2' } })
  expect(screen.getByRole('status', { name: 'Sag' }).textContent).toMatch(/^OK/)
})

test('glossary: about 150 words, searchable; every article and glue has text', () => {
  expect(GLOSSARY.length).toBeGreaterThanOrEqual(140)
  expect(new Set(GLOSSARY.map(g => g.slug)).size).toBe(GLOSSARY.length)
  for (const a of ARTICLES) expect(a.paras.join(' ').length).toBeGreaterThan(40)
  openLibrary('master', 'glossary', { term: 'kerf' })
  render(<Library />)
  expect(screen.getByRole('definition').textContent).toMatch(/width of the cut/)
})
