// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { plans } from '../../src/plans/plansStore'
import { newPlan, type Plan } from '../../src/plans/types'
import { ImportReview } from '../../src/plans/ui/ImportReview'
import { PlanEditor } from '../../src/plans/ui/PlanEditor'
import { serialize } from '../../src/model/fileFormat'
import { applyTemplate, unlock } from '../../src/templates'
import { emptyProject } from '../../src/model/woods'

vi.mock('../../src/kids/ui/ProjectViewer', () => ({ ProjectViewer: () => <div data-testid="viewer" /> }))

function setup(plan: Plan, design: string | null = null) {
  const saved: Plan[] = []
  ;(window as any).aa = {
    plansSave: async (_f: string, p: Plan) => { saved.push(structuredClone(p)) },
    plansReadDesign: async () => design,
    plansFileUrl: async () => 'data:image/png;base64,iVBORw0KGgo=',
    plansList: async () => []
  }
  plans.setState({ current: { folder: 'F', plan }, view: 'edit', kidsView: false, reviewNotes: [] })
  return saved
}
const latest = () => plans.getState().current!.plan

afterEach(cleanup)

test('adding steps and moving one up changes the order', async () => {
  setup(newPlan('Box', 'p_1'))
  render(<PlanEditor />)
  fireEvent.click(screen.getByRole('tab', { name: 'Steps' }))
  fireEvent.click(screen.getByRole('button', { name: 'Add step' }))
  fireEvent.change(screen.getByLabelText('Step 1 text'), { target: { value: 'Cut the sides' } })
  fireEvent.click(screen.getByRole('button', { name: 'Add step' }))
  fireEvent.change(screen.getByLabelText('Step 2 text'), { target: { value: 'Glue up' } })
  fireEvent.click(screen.getByRole('button', { name: 'Move step 2 up' }))
  await vi.waitFor(() => expect(latest().steps.map(s => s.text)).toEqual(['Glue up', 'Cut the sides']))
})

test('a typed cut row reads like a tape measure', async () => {
  setup(newPlan('Box', 'p_1'))
  render(<PlanEditor />)
  fireEvent.click(screen.getByRole('tab', { name: 'Cut list' }))
  fireEvent.click(screen.getByRole('button', { name: 'Add row' }))
  const length = screen.getByLabelText('Row 1 length')
  fireEvent.change(length, { target: { value: '11 3/4' } })
  fireEvent.keyDown(length, { key: 'Enter' })
  await vi.waitFor(() => expect(latest().cutRows[0].length).toBe(11.75))
  await vi.waitFor(() => expect((screen.getByLabelText('Row 1 length') as HTMLInputElement).value).toBe('11-3/4"'))
})

test('with a design attached, the cut list comes from the design and cannot be typed over', async () => {
  const design = serialize(unlock(applyTemplate(emptyProject('Box'), 'box')))
  setup({ ...newPlan('Box', 'p_1'), design: 'design.aaw' }, design)
  render(<PlanEditor />)
  fireEvent.click(screen.getByRole('tab', { name: 'Cut list' }))
  const table = await screen.findByRole('table', { name: 'Cut sheet' })
  expect(within(table).getByText('Front / Back')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Add row' })).toBeNull()
})

function draftedPlan(): Plan {
  return {
    ...newPlan('Stool', 'p_1'),
    source: { kind: 'pdf', name: 'stool.pdf', pages: 1 },
    steps: [{ id: 's_1', text: 'Cut all parts.' }],
    cutRows: [{ id: 'r_1', qty: 2, part: 'Sides', thickness: 0.75, width: 11.25, length: 9, wood: '', notes: '' }],
    review: [{ itemId: 's_1', page: 1, box: [50, 300, 200, 14] }, { itemId: 'r_1', page: 1, box: [50, 200, 220, 14] }],
    unchecked: ['s_1', 'r_1'],
    checkNotes: { r_1: 'check me — converted from metric' }
  }
}

test('the review marks drafted items "check me" with the reason; Accept all clears them', async () => {
  setup(draftedPlan())
  plans.setState({ view: 'import', reviewNotes: ['Nothing readable on page 2 — type the steps yourself.'] })
  render(<ImportReview />)
  expect(screen.getAllByText('check me')).toHaveLength(2)
  expect(screen.getByText('check me — converted from metric')).toBeTruthy()
  expect(screen.getByText('Nothing readable on page 2 — type the steps yourself.')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Accept all' }))
  await vi.waitFor(() => expect(latest().unchecked).toEqual([]))
})

test('clicking a drafted row outlines where it came from on the page', async () => {
  setup(draftedPlan())
  plans.setState({ view: 'import' })
  render(<ImportReview />)
  expect(screen.queryByTestId('source-box')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Show Sides on the page' }))
  expect(await screen.findByTestId('source-box')).toBeTruthy()
})

test('if the attached design file is gone, the cut list falls back to typed rows with a notice', async () => {
  setup({ ...newPlan('Box', 'p_1'), design: 'design.aaw' }, null)
  render(<PlanEditor />)
  fireEvent.click(screen.getByRole('tab', { name: 'Cut list' }))
  expect(await screen.findByText(/attached design couldn't be found/)).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Add row' })).toBeTruthy()
})
