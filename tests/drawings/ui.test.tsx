// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { DrawingsDialog } from '../../src/drawings/ui/DrawingsDialog'
import { stock } from '../../src/optimize/stockStore'
import { studio } from '../../src/ui/store'

afterEach(cleanup)
beforeEach(() => {
  ;(window as any).aa = { setDirty: () => {}, loadStock: async () => [], saveStock: async () => {}, print: async () => {}, savePdf: async () => null }
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
