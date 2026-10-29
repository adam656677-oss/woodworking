// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { draw } from '../../src/sketch/drawStore'
import { newSketch } from '../../src/sketch/types'
import { FreehandBoard } from '../../src/sketch/ui/FreehandBoard'
import { Outputs } from '../../src/sketch/ui/Outputs'
import { studio } from '../../src/ui/store'
import { emptyProject } from '../../src/model/woods'
import { apron } from './fixtures'
import { initSolver } from '../../src/sketch/solver'

beforeAll(async () => { await initSolver() })
afterEach(cleanup)

function setup(sk = apron()) {
  const calls: unknown[][] = []
  ;(window as any).aa = { exportShape: async (...a: unknown[]) => { calls.push(a); return 'C:/x/Apron.dxf' }, print: async () => {}, setDirty: () => {} }
  ;(globalThis as any).ResizeObserver ??= class { observe() {} disconnect() {} }
  studio.setState({ project: emptyProject('T'), screen: 'draw', error: null })
  draw.getState().begin(sk, { isNew: true })
  return calls
}

test('an open drawing can\'t be cut: the button is off and says why', () => {
  const sk = apron()
  sk.entities = sk.entities.filter(e => e.id !== 'e2')
  setup(sk)
  render(<Outputs />)
  expect((screen.getByRole('button', { name: 'Cut a board to this shape' }) as HTMLButtonElement).disabled).toBe(true)
  expect(screen.getByRole('note').textContent).toBe('This outline has a gap — close it to make a part')
})

test('a closed drawing is cut from the chosen wood into a shaped board in the design', () => {
  setup()
  render(<Outputs />)
  fireEvent.click(screen.getByRole('button', { name: 'Cut a board to this shape' }))
  const dialog = screen.getByRole('dialog', { name: 'Choose the wood' })
  fireEvent.change(within(dialog).getByLabelText('Wood'), { target: { value: '1x6' } })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Cut it' }))
  const p = studio.getState().project
  expect(p.sketches?.map(s => s.id)).toEqual(['k1'])
  expect(p.boards).toHaveLength(1)
  expect(p.boards[0]).toMatchObject({ name: 'Apron', woodId: '1x6', width: 4, length: 30, outline: { sketchId: 'k1' } })
  expect(studio.getState().screen).toBe('master')
  expect(studio.getState().selection).toEqual([p.boards[0].id])
})

test('Print full size shows every page with a 1" check square', () => {
  setup()
  render(<Outputs />)
  fireEvent.click(screen.getByRole('button', { name: 'Print full size' }))
  // 30" × 4" over 7-1/2" × 10" pages with 1/2" overlap: 5 across, 1 down.
  const pages = screen.getAllByRole('region', { name: /^Page [A-Z]\d$/ })
  expect(pages.map(p => p.getAttribute('aria-label'))).toEqual(['Page A1', 'Page B1', 'Page C1', 'Page D1', 'Page E1'])
  for (const sq of screen.getAllByTestId('check-square')) expect(sq.style.width).toBe('1in')
  expect([pages[0].style.width, pages[0].style.height]).toEqual(['7.5in', '10in'])
})

test('Export DXF saves the drawing for a CNC', async () => {
  const calls = setup()
  render(<Outputs />)
  fireEvent.click(screen.getByRole('button', { name: 'Export DXF' }))
  await screen.findByText(/Saved C:\/x\/Apron.dxf/)
  expect(calls[0][0]).toBe('dxf')
  expect(String(calls[0][1])).toContain('$INSUNITS')
  expect(calls[0][2]).toBe('Apron')
})

test('the kids\' Size box sets the width to the nearest 1/8"', () => {
  setup(newSketch('k2', 'My drawing', 'freehand'))
  render(<FreehandBoard />)
  fireEvent.click(screen.getByRole('button', { name: /Heart/ }))
  const box = screen.getByLabelText('Width in inches') as HTMLInputElement
  expect(box.value).toBe('6')
  fireEvent.change(box, { target: { value: '5.3' } })
  fireEvent.submit(box.closest('form')!)
  expect((screen.getByLabelText('Width in inches') as HTMLInputElement).value).toBe('5-1/4')
  // A heart is a closed shape, so it can be made into a part.
  expect((screen.getByRole('button', { name: 'Make it a part!' }) as HTMLButtonElement).disabled).toBe(false)
})
