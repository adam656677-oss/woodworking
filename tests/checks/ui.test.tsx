// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { addBoard } from '../../src/model/ops'
import { addDimension } from '../../src/checks/annotations'
import { ChecksPanel } from '../../src/checks/ui/ChecksPanel'
import { ViewTools } from '../../src/checks/ui/ViewTools'
import { studio } from '../../src/ui/store'

afterEach(cleanup)
beforeEach(() => { (window as any).aa = { setDirty: () => {} } })

function start(overlap: boolean) {
  studio.setState({ dirty: false, kidsMode: false })
  const s = studio.getState()
  s.newBlank()
  const ids: string[] = []
  for (const [name, x] of [['A', 0], ['B', overlap ? 5 : 20]] as const) {
    s.apply(p => { const r = addBoard(p, { woodId: '1x6', name, width: 5.5, length: 12, position: { x, y: 0, z: 0 } }); ids.push(r.id); return r.project })
  }
  return ids
}

test('view tools set explode, section (with its place in inches), overall size and dimensions', () => {
  start(false)
  render(<ViewTools />)
  fireEvent.change(screen.getByLabelText('Explode'), { target: { value: '40' } })
  expect(studio.getState().explode).toBe(0.4)
  fireEvent.change(screen.getByLabelText('Section'), { target: { value: 'x' } })
  expect(studio.getState().section).toEqual({ axis: 'x', at: 0.5, flip: false })
  // The design is 25-1/2" across, so halfway is 12-3/4".
  expect(screen.getByTestId('section-at').textContent).toBe('12-3/4"')
  fireEvent.change(screen.getByLabelText('Section position'), { target: { value: '250' } })
  expect(studio.getState().section!.at).toBe(0.25)
  fireEvent.click(screen.getByLabelText('Flip'))
  expect(studio.getState().section!.flip).toBe(true)
  fireEvent.click(screen.getByLabelText('Overall size'))
  expect(studio.getState().overallSize).toBe(true)
  fireEvent.click(screen.getByLabelText('Dimensions & notes'))
  expect(studio.getState().showDims).toBe(false)
  fireEvent.change(screen.getByLabelText('Section'), { target: { value: 'off' } })
  expect(studio.getState().section).toBeNull()
  act(() => studio.getState().setView({ explode: 0, showDims: true, overallSize: false }))
})

test('the interference check lists overlapping parts and selects them; a change asks to check again', async () => {
  const [a, b] = start(true)
  act(() => studio.getState().setView({ checksOpen: 'interference' }))
  render(<ChecksPanel />)
  fireEvent.click(screen.getByRole('button', { name: 'Check for interference' }))
  const item = await screen.findByRole('button', { name: /A and B run into each other — 4\.50 cu in/ })
  fireEvent.click(item)
  expect(studio.getState().selection).toEqual([a, b])
  act(() => studio.getState().apply(p => ({ ...p, boards: p.boards.map(x => (x.id === b ? { ...x, position: { ...x.position, x: 20 } } : x)) })))
  expect(screen.getByText('The design has changed — check again.')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Check for interference' }))
  await waitFor(() => expect(screen.getByRole('status').textContent).toBe('✓ No parts run into each other.'))
})

test('the weight panel shows the total and each part', () => {
  start(false)
  act(() => studio.getState().setView({ checksOpen: 'weight' }))
  render(<ChecksPanel />)
  // Two 3/4 × 5-1/2 × 12 pine boards: 99 cu in × 28 lb/ft³ ≈ 1.6 lb.
  expect(screen.getByTestId('total-weight').textContent).toBe('1.6 lb')
  fireEvent.click(screen.getByRole('button', { name: 'Close checks' }))
  expect(studio.getState().checksOpen).toBeNull()
})

test('dimensions & notes: pin a note, label a dimension, delete', () => {
  start(false)
  act(() => studio.getState().apply(p => { const r = addDimension(p, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 30 }); return 'error' in r ? r : r.project }))
  act(() => studio.getState().setView({ checksOpen: 'notes' }))
  render(<ChecksPanel />)
  fireEvent.click(screen.getByRole('button', { name: 'Add note' }))
  expect(studio.getState().placingNote).toBe(true)
  act(() => studio.getState().setView({ placingNote: false, pendingNote: { x: 1, y: 2, z: 3 } }))
  fireEvent.change(screen.getByLabelText('Note text'), { target: { value: 'Glue here' } })
  fireEvent.click(screen.getByRole('button', { name: 'Add' }))
  expect(studio.getState().project.annotations!.map(a => a.kind)).toEqual(['dimension', 'note'])
  const label = screen.getByLabelText('Dimension label')
  fireEvent.change(label, { target: { value: 'Height' } }); fireEvent.blur(label)
  expect(studio.getState().project.annotations![0]).toMatchObject({ label: 'Height' })
  fireEvent.click(screen.getByRole('button', { name: 'Delete note' }))
  expect(studio.getState().project.annotations).toHaveLength(1)
})
