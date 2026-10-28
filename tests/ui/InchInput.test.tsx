// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { InchInput } from '../../src/ui/designer/InchInput'

afterEach(cleanup)

test('shows the value as a tape-measure fraction', () => {
  render(<InchInput label="Width" value={11.75} onChange={() => {}} />)
  expect(screen.getByLabelText('Width')).toHaveProperty('value', '11-3/4"')
})

test('rejects junk with a reason and does not change the value', () => {
  const onChange = vi.fn()
  render(<InchInput label="Width" value={6} onChange={onChange} />)
  const input = screen.getByLabelText('Width')
  fireEvent.change(input, { target: { value: 'abc' } })
  fireEvent.keyDown(input, { key: 'Enter' })
  expect(onChange).not.toHaveBeenCalled()
  expect(screen.getByRole('alert').textContent).toBe('Enter a size like 11-3/4"')
})

test('accepts 11 3/4 and shows it reformatted', () => {
  const onChange = vi.fn()
  const { rerender } = render(<InchInput label="Width" value={6} onChange={onChange} />)
  const input = screen.getByLabelText('Width')
  fireEvent.change(input, { target: { value: '11 3/4' } })
  fireEvent.keyDown(input, { key: 'Enter' })
  expect(onChange).toHaveBeenCalledWith(11.75)
  rerender(<InchInput label="Width" value={11.75} onChange={onChange} />)
  expect(input).toHaveProperty('value', '11-3/4"')
})

test('Escape restores the old value', () => {
  render(<InchInput label="Width" value={6} onChange={() => {}} />)
  const input = screen.getByLabelText('Width')
  fireEvent.change(input, { target: { value: '99' } })
  fireEvent.keyDown(input, { key: 'Escape' })
  expect(input).toHaveProperty('value', '6"')
})

test('zero allowed only for offset fields', () => {
  const onChange = vi.fn()
  render(<InchInput label="X" value={3} allowZero onChange={onChange} />)
  const input = screen.getByLabelText('X')
  fireEvent.change(input, { target: { value: '0' } })
  fireEvent.keyDown(input, { key: 'Enter' })
  expect(onChange).toHaveBeenCalledWith(0)
})
