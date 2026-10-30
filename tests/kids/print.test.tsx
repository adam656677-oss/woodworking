// @vitest-environment jsdom
import { kidFinish } from '../../src/finish/kids'
import { cleanup, render, screen, within } from '@testing-library/react'
import { designFor, findProject } from '../../src/kids/content'
import { kids } from '../../src/kids/kidsStore'
import { newProgress } from '../../src/kids/progress'
import { Certificate, longDate } from '../../src/kids/ui/Certificate'
import { ProjectSheet } from '../../src/kids/ui/ProjectSheet'
import { cutList } from '../../src/model/cutlist'
import { formatInches } from '../../src/model/units'

vi.mock('../../src/kids/ui/ProjectViewer', () => ({ ProjectViewer: () => <div data-testid="viewer" /> }))

afterEach(cleanup)

test('the birdhouse sheet has every cut-list row, a check box per step and a photo box', () => {
  kids.setState({ loaded: true, progress: { ...newProgress(), passedQuizzes: { 'quiz-1': '2026-10-28', 'quiz-2': '2026-10-28' } } })
  render(<ProjectSheet projectId="birdhouse" />)
  const table = screen.getByRole('table', { name: 'Cut sheet' })
  const rows = cutList(designFor('birdhouse')).rows
  expect(within(table).getAllByRole('row')).toHaveLength(rows.length + 1)
  for (const r of rows) expect(within(table).getAllByText(formatInches(r.length)).length).toBeGreaterThan(0)
  // A box per build step, and one per finishing step.
  expect(screen.getAllByRole('checkbox')).toHaveLength(findProject('birdhouse')!.steps.length + kidFinish(findProject('birdhouse')!)!.steps.length)
  expect(screen.getByRole('region', { name: 'Finishing' }).textContent).toContain('outside')
  expect(screen.getByText('Glue your photo here')).toBeTruthy()
  expect(screen.getByText(/Time spent/)).toBeTruthy()
  expect(screen.getByText(/Cost/)).toBeTruthy()
})

test('dates on certificates read like October 28, 2026', () => {
  expect(longDate('2026-10-28')).toBe('October 28, 2026')
})

test('a certificate shows the child name, the badge and the date', () => {
  kids.setState({ loaded: true, progress: { ...newProgress(), childName: 'Sam', passedQuizzes: { 'quiz-1': '2026-10-28' } } })
  render(<Certificate badgeId="level-1" />)
  expect(screen.getByText('Sam')).toBeTruthy()
  expect(screen.getByText('Sawdust Starter')).toBeTruthy()
  expect(screen.getByText(/October 28, 2026/)).toBeTruthy()
})
