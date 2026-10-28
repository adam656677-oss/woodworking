// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { kids } from '../../src/kids/kidsStore'
import { newProgress } from '../../src/kids/progress'
import { ParentArea } from '../../src/kids/ui/ParentArea'

function setup(pinSet: boolean) {
  const calls: string[] = []
  ;(window as any).aa = {
    kidsPinIsSet: async () => pinSet,
    kidsSetPin: async (pin: string) => { calls.push(`setPin:${pin}`) },
    kidsCheckPin: async (pin: string) => pin === '1234',
    kidsSave: async () => { calls.push('save') },
    kidsPinPath: async () => 'C:\\Users\\me\\AppData\\Roaming\\A&A\\kids-pin.json',
    kidsAddPhoto: async () => null
  }
  kids.setState({ loaded: true, progress: newProgress(), notice: null, page: { name: 'parent' } })
  return calls
}

afterEach(cleanup)

const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } })

test('first visit: the PINs must match', async () => {
  const calls = setup(false)
  render(<ParentArea />)
  await screen.findByText(/Set up the parent PIN/)
  type("Child's first name", 'Sam')
  type('New PIN', '1234')
  type('PIN again', '4321')
  fireEvent.click(screen.getByRole('button', { name: 'Save PIN' }))
  expect(await screen.findByText("The two PINs don't match.")).toBeTruthy()
  expect(calls).toEqual([])
})

test('first visit: letters are not a PIN', async () => {
  const calls = setup(false)
  render(<ParentArea />)
  await screen.findByText(/Set up the parent PIN/)
  type("Child's first name", 'Sam')
  type('New PIN', '12a4')
  type('PIN again', '12a4')
  fireEvent.click(screen.getByRole('button', { name: 'Save PIN' }))
  expect(await screen.findByText('The PIN must be 4 numbers.')).toBeTruthy()
  expect(calls).toEqual([])
})

test('first visit: name and PIN are saved', async () => {
  const calls = setup(false)
  render(<ParentArea />)
  await screen.findByText(/Set up the parent PIN/)
  type("Child's first name", 'Sam')
  type('New PIN', '1234')
  type('PIN again', '1234')
  fireEvent.click(screen.getByRole('button', { name: 'Save PIN' }))
  await vi.waitFor(() => expect(calls).toContain('setPin:1234'))
  expect(kids.getState().progress.childName).toBe('Sam')
})

test('a wrong PIN keeps the settings hidden', async () => {
  setup(true)
  render(<ParentArea />)
  await screen.findByLabelText('PIN')
  type('PIN', '9999')
  fireEvent.click(screen.getByRole('button', { name: 'Open' }))
  expect(await screen.findByText("That PIN isn't right.")).toBeTruthy()
  expect(screen.queryByRole('radio', { name: 'Advanced' })).toBeNull()
})

test('the right PIN shows the settings; changing the tier saves it', async () => {
  const calls = setup(true)
  render(<ParentArea />)
  await screen.findByLabelText('PIN')
  type('PIN', '1234')
  fireEvent.click(screen.getByRole('button', { name: 'Open' }))
  fireEvent.click(await screen.findByRole('radio', { name: 'Advanced' }))
  await vi.waitFor(() => expect(kids.getState().progress.tier).toBe('advanced'))
  expect(calls).toContain('save')
  expect(screen.getByText(/AppData.*kids-pin\.json/)).toBeTruthy()
})
