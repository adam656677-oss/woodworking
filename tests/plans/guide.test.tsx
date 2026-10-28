// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { kids } from '../../src/kids/kidsStore'
import { newProgress } from '../../src/kids/progress'
import { plans } from '../../src/plans/plansStore'
import { newPlan, type Plan } from '../../src/plans/types'
import { BuildGuide } from '../../src/plans/ui/BuildGuide'
import { PlansLibrary } from '../../src/plans/ui/PlansLibrary'

vi.mock('../../src/kids/ui/ProjectViewer', () => ({ ProjectViewer: () => <div data-testid="viewer" /> }))

const plan: Plan = {
  ...newPlan('Step stool', 'p_1'),
  kidFriendly: true,
  tools: ['tape-measure', 'drill'],
  materials: [{ text: 'Pocket screws', amount: '24' }],
  steps: [
    { id: 's1', text: 'Cut the parts.', tool: 'hand-saw' },
    { id: 's2', text: 'Drill pocket holes.', tool: 'drill', tip: 'Clamp the board first.' },
    { id: 's3', text: 'Screw it together.', tool: 'screwdriver' }
  ],
  cutRows: [
    { id: 'r1', qty: 2, part: 'Side', thickness: 0.75, width: 11.25, length: 9, wood: '1x12', notes: '' },
    { id: 'r2', qty: 1, part: 'Top', thickness: 0.75, width: 11.25, length: 16, wood: '1x12', notes: '' }
  ]
}

function setup(kidsView: boolean, tier: 'beginner' | 'intermediate' = 'intermediate') {
  ;(window as any).aa = { plansReadDesign: async () => null, plansFileUrl: async () => null, plansList: async () => [] }
  kids.setState({ loaded: true, progress: { ...newProgress(), tier } })
  plans.setState({ current: { folder: 'F', plan }, view: 'guide', kidsView })
}

afterEach(cleanup)

test('the guide lists every step with a check box and every cut row', () => {
  setup(false)
  render(<BuildGuide />)
  const guide = screen.getByRole('article', { name: 'Build guide' })
  expect(within(guide).getAllByRole('checkbox', { name: /^Step \d+ done$/ })).toHaveLength(3)
  const table = within(guide).getByRole('table', { name: 'Cut list' })
  expect(within(table).getAllByRole('row')).toHaveLength(3)
  expect(within(table).getAllByText('11-1/4"')).toHaveLength(2)
  expect(within(guide).getByText('Clamp the board first.')).toBeTruthy()
  expect(within(guide).getByText(/Pocket screws/)).toBeTruthy()
})

test('the kids\' guide marks the drill step for a grown-up at Beginner, not at Intermediate', () => {
  setup(true, 'beginner')
  const { unmount } = render(<BuildGuide />)
  expect(within(screen.getByText('Drill pocket holes.').closest('li')!).getByText(/Adult does this/)).toBeTruthy()
  unmount()
  setup(true, 'intermediate')
  render(<BuildGuide />)
  expect(within(screen.getByText('Drill pocket holes.').closest('li')!).queryByText(/Adult does this/)).toBeNull()
})

test('the kids\' library shows only kid-friendly plans and no New or Bring in buttons', () => {
  setup(true)
  plans.setState({
    view: 'library',
    list: [
      { folder: 'A', plan: { ...plan, name: 'Kid plan' } },
      { folder: 'B', plan: { ...plan, name: 'Grown-up plan', kidFriendly: false } }
    ]
  })
  render(<PlansLibrary />)
  expect(screen.getByRole('button', { name: 'Kid plan' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Grown-up plan' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'New plan' })).toBeNull()
  expect(screen.queryByRole('button', { name: /Bring in/ })).toBeNull()
})
