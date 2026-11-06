// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { DrawingsDialog } from '../../src/drawings/ui/DrawingsDialog'
import { stock } from '../../src/optimize/stockStore'
import { studio } from '../../src/ui/store'

afterEach(cleanup)
beforeEach(() => {
  ;(window as any).aa = { setDirty: () => {}, loadStock: async () => [], saveStock: async () => {}, print: async () => {}, savePdf: async () => null, printPdf: async () => true }
  stock.setState({ items: [], loaded: true })
  studio.getState().newFromTemplate('bookshelf')
})

test("kids mode prints the kids' packet: a big picture, the pieces and steps to tick", async () => {
  studio.setState({ kidsMode: true })
  render(<DrawingsDialog />)
  expect(screen.getByRole('dialog', { name: 'Drawings' })).toBeTruthy()
  expect(screen.queryByRole('tab')).toBeNull()
  expect(await screen.findByText('The pieces', {}, { timeout: 20000 })).toBeTruthy()
  expect(screen.getByText('How to build it')).toBeTruthy()
  expect(document.body.classList.contains('printing-drawings')).toBe(true)
  cleanup()
  expect(document.body.classList.contains('printing-drawings')).toBe(false)
  studio.setState({ kidsMode: false })
}, 30000)

test('the old plan packet tab is gone: whole plans come from Create Build Plan, the extras tab keeps the rest', async () => {
  render(<DrawingsDialog />)
  const tabs = screen.getAllByRole('tab').map(t => t.textContent)
  expect(tabs).toEqual(['Views', 'Part sheets', 'Templates', 'Extras'])
  expect(screen.getByText(/use Create Build Plan/)).toBeTruthy()
  fireEvent.click(screen.getByRole('tab', { name: 'Extras' }))
  expect(await screen.findByText(/Nothing extra to print yet/, {}, { timeout: 20000 })).toBeTruthy()
}, 30000)
