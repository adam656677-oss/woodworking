// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { BuildPlanAction } from '../../src/drawings/ui/BuildPlanAction'
import { stock } from '../../src/optimize/stockStore'
import { tools } from '../../src/tools/store'
import { studio } from '../../src/ui/store'

const button = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement
const save = () => button('Save as PDF')
const print = () => button('Print')
beforeEach(() => {
  ;(window as any).aa = { setDirty: vi.fn(), loadStock: async () => [], loadData: async () => ({ data: null, damaged: false }), savePdf: vi.fn(async () => 'packet.pdf'), printPdf: vi.fn(async () => true) }
  stock.setState({ items: [], loaded: true })
  tools.setState({ loaded: true, inventory: { tools: [], hardware: [], finishes: [] } })
  studio.setState({ dirty: false, pendingReplace: false, kidsMode: false })
  studio.getState().newFromTemplate('box')
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers() })
async function generate() {
  fireEvent.click(button('Create Build Plan'))
  await screen.findByRole('region', { name: 'Build plan shopping list' }, { timeout: 30000 })
}

test('waits for both inventory stores and accepts loaded empty inventory', async () => {
  let finishStock!: () => void, finishInventory!: () => void
  stock.setState({ loaded: false }); tools.setState({ loaded: false })
  vi.spyOn(stock.getState(), 'load').mockImplementation(() => new Promise<void>(resolve => { finishStock = () => { stock.setState({ loaded: true }); resolve() } }))
  vi.spyOn(tools.getState(), 'load').mockImplementation(() => new Promise<void>(resolve => { finishInventory = () => { tools.setState({ loaded: true }); resolve() } }))
  render(<BuildPlanAction />)
  expect(button('Loading shop inventory…').disabled).toBe(true)
  await act(async () => finishStock())
  expect(button('Loading shop inventory…').disabled).toBe(true)
  await act(async () => finishInventory())
  await generate()
  expect(screen.getByRole('region', { name: 'Build plan shopping list' }).textContent).toContain('Captured with shop inventory deductions.')
}, 60000)

test('load failures prevent generation', async () => {
  stock.setState({ loaded: false })
  vi.spyOn(stock.getState(), 'load').mockRejectedValue(new Error('disk unavailable'))
  render(<BuildPlanAction />)
  expect((await screen.findByRole('status')).textContent).toContain('could not be loaded')
  expect(button('Loading shop inventory…').disabled).toBe(true)
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('hardware, finish and wood changes preserve captured rows and block export until regeneration', async () => {
  render(<BuildPlanAction />); await generate()
  const changes = [
    () => tools.setState({ inventory: { ...tools.getState().inventory, hardware: [{ id: 'h', itemId: 'test', name: 'Test hardware', qty: 2 }] } }),
    () => tools.setState({ inventory: { ...tools.getState().inventory, finishes: [{ id: 'f', product: 'Test finish', amount: 1, unit: 'can' }] } }),
    () => stock.setState({ items: [{ id: 's', woodId: studio.getState().project.boards[0].woodId, kind: 'sheet', width: 48, length: 96 }] })
  ]
  for (const change of changes) {
    const captured = screen.getByRole('region', { name: 'Build plan shopping list' }).textContent
    act(change)
    expect(save().disabled).toBe(true); expect(print().disabled).toBe(true)
    expect(screen.getByRole('alert').textContent).toContain('inventory changed')
    expect(screen.getByRole('region', { name: 'Build plan shopping list' }).textContent).toBe(captured)
    fireEvent.click(save()); fireEvent.click(print())
    expect(window.aa.savePdf).not.toHaveBeenCalled(); expect(window.aa.printPdf).not.toHaveBeenCalled()
    fireEvent.click(button('Update Plan'))
    await waitFor(() => expect(save().disabled).toBe(false), { timeout: 30000 })
    expect(print().disabled).toBe(false)
  }
}, 120000)

test('cancelled saves and save failures preserve the plan and permit retry', async () => {
  vi.mocked(window.aa.savePdf).mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('disk full')).mockResolvedValueOnce('packet.pdf')
  render(<BuildPlanAction />); await generate()
  const source = JSON.stringify(studio.getState().project)
  const captured = screen.getByRole('region', { name: 'Build plan shopping list' }).textContent
  fireEvent.click(save())
  await waitFor(() => expect(save().disabled).toBe(false))
  expect(screen.queryByText('Build plan saved as PDF.')).toBeNull()
  fireEvent.click(save())
  await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Export failed'))
  fireEvent.click(save())
  await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Build plan saved as PDF.'))
  expect(JSON.stringify(studio.getState().project)).toBe(source)
  expect(screen.getByRole('region', { name: 'Build plan shopping list' }).textContent).toBe(captured)
}, 60000)

test('viewer failures and thrown print errors permit retry', async () => {
  vi.mocked(window.aa.printPdf).mockResolvedValueOnce(false).mockRejectedValueOnce(new Error('viewer unavailable')).mockResolvedValueOnce(true)
  render(<BuildPlanAction />); await generate()
  fireEvent.click(print())
  await waitFor(() => expect(screen.getByRole('status').textContent).toContain('could not be opened'))
  fireEvent.click(print())
  await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Export failed'))
  fireEvent.click(print())
  await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Opened in your PDF viewer'))
}, 60000)

test('switching projects cancels pending generation', async () => {
  vi.useFakeTimers(); render(<BuildPlanAction />)
  fireEvent.click(button('Create Build Plan'))
  act(() => studio.setState({ projectKey: studio.getState().projectKey + 1 }))
  await act(async () => { await vi.runAllTimersAsync() })
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(button('Create Build Plan').disabled).toBe(false)
})
