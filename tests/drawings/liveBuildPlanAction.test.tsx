// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { stock } from '../../src/optimize/stockStore'
import { tools } from '../../src/tools/store'
import { LiveBuildPlanAction } from '../../src/drawings/ui/LiveBuildPlanAction'

vi.mock('../../src/drawings/ui/BuildPlanAction', () => ({ BuildPlanAction: ({ disabled }: { disabled: boolean }) => <button disabled={disabled}>Ready generator</button> }))
beforeEach(() => { stock.setState({ loaded: false, items: [] }); tools.setState({ loaded: false, inventory: { tools: [], hardware: [], finishes: [] } }) })
afterEach(() => { cleanup(); vi.restoreAllMocks() })

test('a failed source can be retried without reloading an already loaded source', async () => {
  const wood = vi.spyOn(stock.getState(), 'load').mockRejectedValueOnce(new Error('disk busy')).mockImplementationOnce(async () => { stock.setState({ loaded: true }) })
  const inventory = vi.spyOn(tools.getState(), 'load').mockImplementation(async () => { tools.setState({ loaded: true }) })
  render(<LiveBuildPlanAction />)
  expect(screen.queryByText('Ready generator')).toBeNull()
  await screen.findByRole('alert')
  fireEvent.click(screen.getByRole('button', { name: 'Retry shop inventory' }))
  await screen.findByRole('button', { name: 'Ready generator' })
  expect(wood).toHaveBeenCalledTimes(2)
  expect(inventory).toHaveBeenCalledTimes(1)
})

test('retry is unavailable until both outstanding loads settle', async () => {
  let finish!: () => void
  vi.spyOn(stock.getState(), 'load').mockRejectedValue(new Error('disk busy'))
  vi.spyOn(tools.getState(), 'load').mockImplementation(() => new Promise<void>(resolve => { finish = () => { tools.setState({ loaded: true }); resolve() } }))
  render(<LiveBuildPlanAction />)
  await waitFor(() => expect(finish).toBeTypeOf('function'))
  expect(screen.queryByRole('button', { name: 'Retry shop inventory' })).toBeNull()
  await act(async () => finish())
  await screen.findByRole('button', { name: 'Retry shop inventory' })
})

test('disabled navigation also disables retry', async () => {
  vi.spyOn(stock.getState(), 'load').mockRejectedValue(new Error('disk busy'))
  vi.spyOn(tools.getState(), 'load').mockImplementation(async () => { tools.setState({ loaded: true }) })
  render(<LiveBuildPlanAction disabled />)
  const retry = await screen.findByRole('button', { name: 'Retry shop inventory' }) as HTMLButtonElement
  expect(retry.disabled).toBe(true)
})
