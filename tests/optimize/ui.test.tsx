// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { CutListView } from '../../src/ui/designer/CutListView'
import { BandingSection } from '../../src/optimize/ui/BandingSection'
import { stock } from '../../src/optimize/stockStore'
import { studio } from '../../src/ui/store'

afterEach(cleanup)
beforeEach(() => {
  ;(window as any).aa = { setDirty: () => {}, loadStock: async () => [], saveStock: async () => {}, print: async () => {} }
  stock.setState({ items: [], loaded: true })
  studio.setState({ dirty: false, kidsMode: false })
  studio.getState().newFromTemplate('bookshelf')
  studio.getState().apply(p => { const { template: _t, ...rest } = p; return { ...rest, woods: rest.woods.map(w => (w.id === 'ply-3-4' ? { ...w, pricePerSheet: 60 } : w.id === 'ply-1-4' ? { ...w, pricePerSheet: 30 } : w)) } })
})

test('the Layout tab draws a sheet per material with numbered cuts; kerf changes are kept', () => {
  render(<CutListView />)
  fireEvent.click(screen.getByRole('tab', { name: 'Layout' }))
  const ply = screen.getByRole('region', { name: 'Layout for 3/4" Plywood' })
  expect(ply.textContent).toContain('3/4" Plywood — 1 sheet')
  expect(within(ply).getAllByRole('listitem')[0].textContent).toMatch(/^Rip a strip/)
  const kerf = within(ply).getByLabelText('Saw kerf')
  fireEvent.change(kerf, { target: { value: '3/32' } }); fireEvent.blur(kerf)
  expect(studio.getState().project.cutSettings?.byWood?.['ply-3-4']?.kerf).toBe(3 / 32)
})

test('the Buy tab totals sheets with tax; the Labels tab lays out one label per part', () => {
  render(<CutListView />)
  fireEvent.click(screen.getByRole('tab', { name: 'Buy' }))
  expect(screen.getByTestId('buy-total').textContent).toBe('$90.00')
  fireEvent.change(screen.getByLabelText('Sales tax'), { target: { value: '10' } })
  expect(screen.getByTestId('buy-total').textContent).toBe('$99.00')
  fireEvent.click(screen.getByRole('tab', { name: 'Labels' }))
  expect(screen.getAllByLabelText('QR code')).toHaveLength(studio.getState().project.boards.length)
  expect(screen.getAllByTestId('label-page')).toHaveLength(1)
})

test('edge banding is set from the part\'s properties', () => {
  const shelf = studio.getState().project.boards.find(b => b.name === 'Shelf')!
  const { rerender } = render(<BandingSection board={shelf} />)
  fireEvent.click(screen.getByLabelText('Left edge'))
  const after = studio.getState().project.boards.find(b => b.id === shelf.id)!
  expect(after.banding).toEqual({ edges: ['left'], bandId: 'band-birch' })
  act(() => rerender(<BandingSection board={after} />))
  fireEvent.change(screen.getByLabelText('Banding'), { target: { value: 'band-wood' } })
  expect(studio.getState().project.boards.find(b => b.id === shelf.id)!.banding!.bandId).toBe('band-wood')
})
