// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { CutListView } from '../../src/ui/designer/CutListView'

const mocks = vi.hoisted(() => ({
  exportCsv: vi.fn<(...args: unknown[]) => Promise<string | null>>(),
  print: vi.fn<(...args: unknown[]) => Promise<void>>(),
  set: vi.fn(),
  state: { project: { name: 'Test cabinet' }, kidsMode: false }
}))
vi.mock('../../src/ui/store', () => ({ useStudio: (selector: (s: typeof mocks.state) => unknown) => selector(mocks.state), studio: { getState: () => ({ set: mocks.set }) } }))
vi.mock('../../src/model/cutlist', () => ({ cutList: () => ({ rows: [], totals: { boardFeetByWood: {}, sheetsByWood: {} } }), cutListCsv: () => 'Qty,Part\n1,Shelf' }))
vi.mock('../../src/cabinet/ui/HardwareList', () => ({ HardwareList: () => null }))
vi.mock('../../src/optimize/ui/LayoutTab', () => ({ LayoutTab: () => null }))
vi.mock('../../src/optimize/ui/BuyTab', () => ({ BuyTab: () => null }))
vi.mock('../../src/optimize/ui/LabelsTab', () => ({ LabelsTab: () => null }))

const originalApi = Object.getOwnPropertyDescriptor(window, 'aa')
beforeEach(() => {
  vi.resetAllMocks()
  mocks.exportCsv.mockResolvedValue(null)
  mocks.print.mockResolvedValue(undefined)
  Object.defineProperty(window, 'aa', { configurable: true, value: { exportCsv: mocks.exportCsv, print: mocks.print } })
})
afterEach(() => {
  cleanup()
  if (originalApi) Object.defineProperty(window, 'aa', originalApi)
  else Reflect.deleteProperty(window, 'aa')
})

test('a failed CSV export shows an error and permits a successful retry', async () => {
  mocks.exportCsv.mockRejectedValueOnce(new Error('disk')).mockResolvedValueOnce('cabinet.csv')
  render(<CutListView />)
  fireEvent.click(screen.getByRole('button', { name: 'Save as CSV' }))
  expect((await screen.findByRole('alert')).textContent).toContain('Could not save the CSV')
  await waitFor(() => expect((screen.getByRole('button', { name: 'Save as CSV' }) as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(screen.getByRole('button', { name: 'Save as CSV' }))
  expect((await screen.findByRole('status')).textContent).toBe('Saved cabinet.csv')
  expect(screen.queryByRole('alert')).toBeNull()
  expect(mocks.exportCsv).toHaveBeenLastCalledWith('Qty,Part\n1,Shelf', 'Test cabinet')
})

test('canceling the save dialog produces neither success nor error', async () => {
  render(<CutListView />)
  fireEvent.click(screen.getByRole('button', { name: 'Save as CSV' }))
  await waitFor(() => expect((screen.getByRole('button', { name: 'Save as CSV' }) as HTMLButtonElement).disabled).toBe(false))
  expect(mocks.exportCsv).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole('status')).toBeNull()
  expect(screen.queryByRole('alert')).toBeNull()
})

test('pending exports block duplicate output and tab changes', async () => {
  let finish!: (value: string | null) => void
  mocks.exportCsv.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  render(<CutListView />)
  fireEvent.click(screen.getByRole('button', { name: 'Save as CSV' }))
  const saving = screen.getByRole('button', { name: 'Saving…' }) as HTMLButtonElement
  const print = screen.getByRole('button', { name: 'Print' }) as HTMLButtonElement
  expect(saving.disabled).toBe(true)
  expect(print.disabled).toBe(true)
  for (const tab of screen.getAllByRole('tab')) expect((tab as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(saving)
  fireEvent.click(print)
  expect(mocks.exportCsv).toHaveBeenCalledTimes(1)
  expect(mocks.print).not.toHaveBeenCalled()
  await act(async () => { finish(null) })
  expect((screen.getByRole('button', { name: 'Print' }) as HTMLButtonElement).disabled).toBe(false)
})

test('label printing preserves portrait and edge-to-edge options', async () => {
  render(<CutListView />)
  fireEvent.click(screen.getByRole('tab', { name: 'Labels' }))
  fireEvent.click(screen.getByRole('button', { name: 'Print labels' }))
  await waitFor(() => expect(mocks.print).toHaveBeenCalledWith({ landscape: false, edgeToEdge: true }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Print labels' })).toBeTruthy())
})

test('a failed print request shows an error and restores controls', async () => {
  mocks.print.mockRejectedValueOnce(new Error('printer'))
  render(<CutListView />)
  fireEvent.click(screen.getByRole('button', { name: 'Print' }))
  expect((await screen.findByRole('alert')).textContent).toContain('Could not complete printing')
  expect(mocks.print).toHaveBeenCalledWith(undefined)
  await waitFor(() => expect((screen.getByRole('button', { name: 'Print' }) as HTMLButtonElement).disabled).toBe(false))
})
