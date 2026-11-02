// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { FormulaInput } from '../../src/formulas/ui/FormulaInput'

afterEach(cleanup)

it('preserves a sixty-fourth when an adult size field is focused and blurred', () => {
  const onSet = vi.fn()
  render(<FormulaInput label="Width" value={1 / 64} onSet={onSet} />)
  const input = screen.getByLabelText('Width')
  expect((input as HTMLInputElement).value).toBe('1/64"')
  fireEvent.focus(input)
  fireEvent.blur(input)
  expect(onSet).not.toHaveBeenCalled()
})

it('reveals the existing formula without replacing it on blur', () => {
  const onSet = vi.fn()
  render(<FormulaInput label="Length" value={6 + 1 / 64} formula="H" onSet={onSet} />)
  const input = screen.getByLabelText('Length')
  expect((input as HTMLInputElement).value).toBe('6-1/64"')
  fireEvent.focus(input)
  expect((input as HTMLInputElement).value).toBe('=H')
  fireEvent.blur(input)
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(onSet).not.toHaveBeenCalled()
})

it('shows precise replacement dimensions and requires approval', () => {
  const onSet = vi.fn()
  render(<FormulaInput label="Width" value={6} formula="W" onSet={onSet} />)
  const input = screen.getByLabelText('Width')
  fireEvent.focus(input)
  fireEvent.change(input, { target: { value: '7 1/64' } })
  fireEvent.keyDown(input, { key: 'Enter' })
  expect(screen.getByRole('dialog').textContent).toContain('7-1/64"')
  expect(onSet).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Replace', exact: true }))
  expect(onSet).toHaveBeenCalledWith({ value: 7 + 1 / 64 })
})

it('cancels local edits without forwarding Escape to the designer', () => {
  const parentKey = vi.fn()
  const onSet = vi.fn()
  render(<div onKeyDown={parentKey}><FormulaInput label="Width" value={6} formula="W" onSet={onSet} /></div>)
  const input = screen.getByLabelText('Width')
  fireEvent.focus(input)
  fireEvent.change(input, { target: { value: 'bad' } })
  fireEvent.keyDown(input, { key: 'Escape' })
  expect((input as HTMLInputElement).value).toBe('=W')
  expect(parentKey).not.toHaveBeenCalled()
  expect(onSet).not.toHaveBeenCalled()
})
