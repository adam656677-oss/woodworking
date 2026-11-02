// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { InchInput } from '../../src/ui/designer/InchInput'

afterEach(cleanup)

it('displays a sixty-fourth without rounding it to a thirty-second', () => {
  const onChange = vi.fn()
  render(<InchInput label="Width" value={1 / 64} onChange={onChange} />)
  const input = screen.getByLabelText('Width')
  expect((input as HTMLInputElement).value).toBe('1/64"')
  fireEvent.blur(input)
  expect(onChange).not.toHaveBeenCalled()
})

it('commits corrected text on blur after an invalid entry', () => {
  const onChange = vi.fn()
  render(<InchInput label="Width" value={6} onChange={onChange} />)
  const input = screen.getByLabelText('Width')
  fireEvent.change(input, { target: { value: 'abc' } })
  fireEvent.keyDown(input, { key: 'Enter' })
  expect(screen.getByRole('alert')).toBeTruthy()
  fireEvent.change(input, { target: { value: '7 1/64' } })
  expect(screen.queryByRole('alert')).toBeNull()
  fireEvent.blur(input)
  expect(onChange).toHaveBeenCalledWith(7 + 1 / 64)
})

it('associates the error message with its field', () => {
  render(<InchInput label="Width" value={6} onChange={() => {}} />)
  const input = screen.getByLabelText('Width')
  fireEvent.change(input, { target: { value: '0' } })
  fireEvent.blur(input)
  expect(input.getAttribute('aria-invalid')).toBe('true')
  expect(input.getAttribute('aria-describedby')).toBe(screen.getByRole('alert').id)
})

it('Escape cancels a local edit without reaching the parent', () => {
  const parentKey = vi.fn()
  const onChange = vi.fn()
  render(<div onKeyDown={parentKey}><InchInput label="Width" value={1 / 64} onChange={onChange} /></div>)
  const input = screen.getByLabelText('Width')
  fireEvent.change(input, { target: { value: 'bad' } })
  fireEvent.keyDown(input, { key: 'Enter' })
  fireEvent.keyDown(input, { key: 'Escape' })
  expect((input as HTMLInputElement).value).toBe('1/64"')
  expect(screen.queryByRole('alert')).toBeNull()
  expect(parentKey).not.toHaveBeenCalled()
  expect(onChange).not.toHaveBeenCalled()
})

it('updates displayed precision when the model value changes', () => {
  const { rerender } = render(<InchInput label="Width" value={6} onChange={() => {}} />)
  rerender(<InchInput label="Width" value={6 + 1 / 64} onChange={() => {}} />)
  expect((screen.getByLabelText('Width') as HTMLInputElement).value).toBe('6-1/64"')
})
