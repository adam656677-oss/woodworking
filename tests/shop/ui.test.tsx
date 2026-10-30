// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { ShopMode } from '../../src/shop/ui/ShopMode'
import { shop } from '../../src/shop/shopStore'
import { emptyProgress, type ShopStep } from '../../src/shop/steps'

afterEach(() => { cleanup(); act(() => shop.getState().close()) })
const steps: ShopStep[] = [
  { key: 'a', title: 'Cut the parts', text: 'Cut 3 parts.', tools: ['Saw'], parts: [{ qty: 2, name: 'Side', size: '3/4" × 10" × 30"' }] },
  { key: 'b', title: 'Drill', text: 'Drill the holes.', tools: [], parts: [], adult: true },
  { key: 'c', title: 'Glue up', text: 'Glue it.', tools: [], parts: [] }
]

test('Shop Mode steps through with buttons and keys, ticks steps, keeps the screen on, and exits with Esc', () => {
  const awake = vi.fn(async () => {})
  ;(window as any).aa = { keepAwake: awake }
  const save = vi.fn()
  render(<ShopMode />)
  act(() => shop.getState().open({ title: 'Bookshelf', steps, progress: emptyProgress(), kid: false, save }))
  expect(awake).toHaveBeenCalledWith(true)
  expect(screen.getByTestId('step-count').textContent).toBe('Step 1 of 3')
  expect(screen.getByText('Side')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Next ▶' }))
  expect(screen.getByTestId('step-title').textContent).toBe('Drill')
  expect(screen.getByText('⚠ Adult does this')).toBeTruthy()
  fireEvent.keyDown(window, { key: 'ArrowRight' })
  expect(screen.getByTestId('step-count').textContent).toBe('Step 3 of 3')
  fireEvent.keyDown(window, { key: 'PageUp' })
  expect(screen.getByTestId('step-count').textContent).toBe('Step 2 of 3')
  fireEvent.click(screen.getByRole('checkbox'))
  expect(save).toHaveBeenLastCalledWith({ done: ['b'], minutes: {} })
  const before = (screen.getByTestId('step-title') as HTMLElement).style.fontSize
  fireEvent.click(screen.getByRole('button', { name: 'Bigger text' }))
  expect((screen.getByTestId('step-title') as HTMLElement).style.fontSize).not.toBe(before)
  fireEvent.keyDown(window, { key: 'Escape' })
  expect(screen.queryByRole('dialog', { name: 'Shop Mode' })).toBeNull()
  expect(awake).toHaveBeenLastCalledWith(false)
})

test('the timer logs minutes to the step it ran on', () => {
  ;(window as any).aa = { keepAwake: async () => {} }
  const save = vi.fn()
  const now = vi.spyOn(Date, 'now')
  now.mockReturnValue(0)
  render(<ShopMode />)
  act(() => shop.getState().open({ title: 'T', steps, progress: emptyProgress(), kid: false, save }))
  fireEvent.click(screen.getByRole('button', { name: '⏱ Start timer' }))
  now.mockReturnValue(3 * 60000)
  fireEvent.click(screen.getByRole('button', { name: '⏹ Stop timer' }))
  expect(screen.getByTestId('step-minutes').textContent).toBe('3 min')
  expect(save).toHaveBeenLastCalledWith({ done: [], minutes: { a: 3 } })
  now.mockRestore()
})
