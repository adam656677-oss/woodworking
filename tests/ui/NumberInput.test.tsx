// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { NumberInput } from '../../src/ui/common/NumberInput'

afterEach(cleanup)

test('a blank entry is ignored and the box shows the current value again', () => {
  const onChange = vi.fn()
  render(<NumberInput label="Miter°" value={45} onChange={onChange} />)
  const input = screen.getByLabelText('Miter°') as HTMLInputElement
  fireEvent.change(input, { target: { value: '' } })
  fireEvent.blur(input)
  expect(onChange).not.toHaveBeenCalled()
  expect(input.value).toBe('45')
})

test('a typed number commits on Enter, kept within the limits', () => {
  const onChange = vi.fn()
  render(<NumberInput label="Screws" value={2} min={1} max={10} onChange={onChange} />)
  const input = screen.getByLabelText('Screws') as HTMLInputElement
  fireEvent.change(input, { target: { value: '25' } })
  fireEvent.blur(input)
  expect(onChange).toHaveBeenCalledWith(10)
})
