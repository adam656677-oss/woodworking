// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { FinishingSchool, openFinishing } from '../../src/finish/ui/FinishingSchool'
import { studio } from '../../src/ui/store'

afterEach(cleanup)
beforeEach(() => {
  ;(window as any).aa = { setDirty: () => {}, openLink: async () => true }
  studio.setState({ kidsMode: false })
  studio.getState().newFromTemplate('bookshelf')
})

test('lessons open; the shellac lesson has the cut chart', () => {
  openFinishing('master')
  render(<FinishingSchool />)
  fireEvent.click(within(screen.getByRole('complementary', { name: 'Lessons' })).getByText('Shellac'))
  expect(screen.getByRole('article', { name: 'Shellac' })).toBeTruthy()
  expect(screen.getByRole('table', { name: 'Shellac cuts' }).textContent).toContain('2 oz')
})

test('the selector ranks finishes and compares two', () => {
  openFinishing('master', 'select')
  render(<FinishingSchool />)
  const list = screen.getByRole('list', { name: 'Best finishes' })
  // Tough and easy, wiped or brushed: wipe-on poly comes first.
  expect(within(list).getAllByRole('listitem')[0].textContent).toContain('Wipe-on polyurethane')
  fireEvent.click(screen.getByLabelText('Compare Oil-based polyurethane'))
  fireEvent.click(screen.getByLabelText('Compare Wipe-on polyurethane'))
  expect(screen.getByRole('table', { name: 'Compare finishes' }).textContent).toContain('Recoat after')
})

test('the checker answers', () => {
  openFinishing('master', 'check')
  render(<FinishingSchool />)
  fireEvent.change(screen.getByLabelText('Top finish'), { target: { value: 'water-poly' } })
  fireEvent.change(screen.getByLabelText('Under finish'), { target: { value: 'oil-stain' } })
  expect(screen.getByRole('status', { name: 'Answer' }).textContent).toContain('Yes, with a barrier coat')
})

test('the schedule builder: start from a template, a bad step is flagged, and it is kept on the project', () => {
  openFinishing('master', 'schedule')
  render(<FinishingSchool />)
  fireEvent.click(screen.getByText('Wipe-on poly'))
  expect(studio.getState().project.finish?.name).toBe('Wipe-on poly')
  fireEvent.click(screen.getByText('Add a step'))
  const last = screen.getAllByRole('listitem', { name: /Step \d/ }).at(-1)!
  fireEvent.change(within(last).getByLabelText('Finish'), { target: { value: 'nitro' } })
  expect(within(last).getByRole('alert').textContent).toMatch(/wrinkles/)
  expect(studio.getState().dirty).toBe(true)
})
