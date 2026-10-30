// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { addBoard } from '../../src/model/ops'
import { CabinetDialog } from '../../src/cabinet/ui/CabinetDialog'
import { HardwareList } from '../../src/cabinet/ui/HardwareList'
import { ChecksPanel } from '../../src/checks/ui/ChecksPanel'
import { studio } from '../../src/ui/store'

afterEach(cleanup)
beforeEach(() => { (window as any).aa = { setDirty: () => {} } })
function start() {
  studio.setState({ dirty: false, kidsMode: false })
  studio.getState().newBlank()
  const ids: string[] = []
  // Two cabinet sides 15" apart (inside), 30" tall, 12" deep.
  for (const x of [0, 15.71875]) studio.getState().apply(p => { const r = addBoard(p, { woodId: 'ply-3-4', name: 'Side', width: 12, length: 30, position: { x, y: 0, z: 0 }, rotation: { x: 90, y: 90, z: 0 } }); ids.push(r.id); return r.project })
  return ids
}

test('the door maker takes the opening from the selected sides and makes a door with its hardware', () => {
  const sides = start()
  act(() => { studio.getState().select(sides); studio.getState().setView({ cabinet: 'door' }) })
  render(<CabinetDialog />)
  const d = screen.getByRole('dialog', { name: 'Add a door' })
  expect((within(d).getByLabelText('Opening width') as HTMLInputElement).value).toBe('15"')
  fireEvent.change(within(d).getByLabelText('Style'), { target: { value: 'slab' } })
  fireEvent.click(within(d).getByRole('button', { name: 'Make it' }))
  expect(studio.getState().cabinet).toBeNull()
  const p = studio.getState().project
  expect(p.groups!.map(g => g.name)).toEqual(['Door 1'])
  expect(p.boards.find(b => b.name === 'Door')!.width).toBe(16)
  render(<HardwareList />)
  expect(screen.getByRole('region', { name: 'Hardware' }).textContent).toContain('Concealed hinge, full overlay (35 mm)')
})

test('the drawer maker reports an opening too shallow; the hardware list adds, prices and removes', () => {
  start()
  act(() => studio.getState().setView({ cabinet: 'drawer' }))
  render(<CabinetDialog />)
  const d = screen.getByRole('dialog', { name: 'Add a drawer' })
  const depth = within(d).getByLabelText('Opening depth')
  fireEvent.change(depth, { target: { value: '8' } }); fireEvent.blur(depth)
  fireEvent.click(within(d).getByRole('button', { name: 'Make it' }))
  expect(within(d).getByRole('alert').textContent).toMatch(/too shallow/)
  cleanup()
  render(<HardwareList />)
  fireEvent.change(screen.getByLabelText('Hardware item'), { target: { value: 'knob' } })
  fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '4' } })
  fireEvent.click(screen.getByRole('button', { name: 'Add' }))
  const price = screen.getByLabelText('Price of Knob 1-1/4"')
  fireEvent.change(price, { target: { value: '2.50' } }); fireEvent.blur(price)
  expect(screen.getByRole('region', { name: 'Hardware' }).textContent).toContain('Hardware total: $10.00')
  fireEvent.click(screen.getByRole('button', { name: 'Remove Knob 1-1/4"' }))
  expect(studio.getState().project.hardware).toBeUndefined()
})

test('shelf pins on both selected sides; the clearance check runs', async () => {
  const sides = start()
  act(() => { studio.getState().select(sides); studio.getState().setView({ cabinet: 'pins' }) })
  render(<CabinetDialog />)
  fireEvent.click(screen.getByRole('button', { name: 'Make it' }))
  const p = studio.getState().project
  expect(p.boards.every(b => b.holes.length > 0)).toBe(true)
  // The two sides' holes face each other.
  expect(new Set(p.boards.map(b => b.holes[0].face)).size).toBe(2)
  cleanup()
  act(() => studio.getState().setView({ checksOpen: 'clearance' }))
  render(<ChecksPanel />)
  expect(screen.getByText(/Add a door or drawer/)).toBeTruthy()
})
