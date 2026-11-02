// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { NumberInput } from '../../src/ui/common/NumberInput'

afterEach(cleanup)

test('Escape restores the current value without committing or reaching parent shortcuts', () => {
  const onChange = vi.fn()
  const parentKey = vi.fn()
  render(<div onKeyDown={parentKey}><NumberInput label="Angle" value={45} onChange={onChange} /></div>)
  const input = screen.getByRole('spinbutton', { name: 'Angle' }) as HTMLInputElement
  input.focus()
  fireEvent.change(input, { target: { value: '90' } })
  fireEvent.keyDown(input, { key: 'Escape' })
  expect(input.value).toBe('45')
  expect(onChange).not.toHaveBeenCalled()
  expect(parentKey).not.toHaveBeenCalled()
  expect(document.activeElement).not.toBe(input)
})

test('Enter commits a focused field without reaching parent shortcuts', () => {
  const onChange = vi.fn()
  const parentKey = vi.fn()
  render(<div onKeyDown={parentKey}><NumberInput label="Count" value={2} onChange={onChange} /></div>)
  const input = screen.getByRole('spinbutton', { name: 'Count' }) as HTMLInputElement
  input.focus()
  fireEvent.change(input, { target: { value: '4' } })
  fireEvent.keyDown(input, { key: 'Enter' })
  expect(onChange).toHaveBeenCalledExactlyOnceWith(4)
  expect(parentKey).not.toHaveBeenCalled()
})

test('clamping updates the displayed value even before the parent rerenders', () => {
  const onChange = vi.fn()
  render(<NumberInput label="Count" value={2} min={1} max={10} onChange={onChange} />)
  const input = screen.getByRole('spinbutton', { name: 'Count' }) as HTMLInputElement
  fireEvent.change(input, { target: { value: '25' } })
  fireEvent.blur(input)
  expect(onChange).toHaveBeenCalledWith(10)
  expect(input.value).toBe('10')
})

test('a changed model value becomes the cancellation baseline', () => {
  const onChange = vi.fn()
  const { rerender } = render(<NumberInput label="Angle" value={45} onChange={onChange} />)
  rerender(<NumberInput label="Angle" value={30} onChange={onChange} />)
  const input = screen.getByRole('spinbutton', { name: 'Angle' }) as HTMLInputElement
  input.focus()
  fireEvent.change(input, { target: { value: '80' } })
  fireEvent.keyDown(input, { key: 'Escape' })
  expect(input.value).toBe('30')
  expect(onChange).not.toHaveBeenCalled()
})
