// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { addBoard } from '../../src/model/ops'
import { sketchOf } from '../../src/model/shaped'
import { emptyProject } from '../../src/model/woods'
import { PropertiesPanel } from '../../src/ui/designer/PropertiesPanel'
import { studio } from '../../src/ui/store'

afterEach(cleanup)
beforeEach(() => { (window as any).aa = { setDirty: () => {} } })

function select(woodId: string, width: number, length: number, kidsMode = false) {
  const r = addBoard(emptyProject('T'), { woodId, name: 'Leg', width, length })
  studio.setState({ project: r.project, selection: [r.id], kidsMode, screen: 'master', error: null })
  render(<PropertiesPanel />)
  return r.id
}
const board = () => studio.getState().project.boards[0]

test('Turn this leg turns a 2x2; a new style redraws the profile; Remove turning puts it back', () => {
  select('2x2', 1.5, 29)
  fireEvent.click(screen.getByRole('button', { name: 'Turn this leg' }))
  expect(board().turning).toMatchObject({ style: 'vase', top: 5 })
  const before = JSON.stringify(sketchOf(studio.getState().project, board().turning!.sketchId)!.points)
  fireEvent.change(screen.getByLabelText('Turning style'), { target: { value: 'ballFoot' } })
  expect(board().turning!.style).toBe('ballFoot')
  expect(JSON.stringify(sketchOf(studio.getState().project, board().turning!.sketchId)!.points)).not.toBe(before)
  fireEvent.click(screen.getByRole('button', { name: 'Remove turning' }))
  expect(board().turning).toBeUndefined()
  expect(studio.getState().project.sketches).toEqual([])
})

test('a board that isn\'t square says why it can\'t be turned', () => {
  select('1x4', 3.5, 20)
  fireEvent.click(screen.getByRole('button', { name: 'Turn this leg' }))
  expect(screen.getByRole('alert').textContent).toMatch(/Turning needs a square blank/)
  expect(board().turning).toBeUndefined()
})

test('the taper end view toggles faces; a foot bigger than the leg is refused and nothing changes', () => {
  select('2x2', 1.5, 29)
  fireEvent.click(screen.getByRole('button', { name: 'Taper this part' }))
  expect(board().taper!.faces).toHaveLength(2)
  fireEvent.click(screen.getByRole('button', { name: 'All four faces' }))
  expect(board().taper!.faces).toHaveLength(4)
  fireEvent.click(screen.getByRole('button', { name: 'Taper the top face' }))
  expect(board().taper!.faces).not.toContain('top')
  const before = board().taper
  const foot = screen.getByLabelText('Size at the foot')
  fireEvent.change(foot, { target: { value: '2' } })
  fireEvent.blur(foot)
  fireEvent.keyDown(foot, { key: 'Enter' })
  expect(screen.getByRole('alert').textContent).toBe("The foot can't be bigger than the leg")
  expect(board().taper).toEqual(before)
})

test('All top edges ticks the four top edges and adds the profile', () => {
  select('1x12', 11.25, 30)
  fireEvent.click(screen.getByRole('button', { name: 'All top edges' }))
  for (const s of ['Left', 'Right', 'Start', 'End']) expect((screen.getByLabelText(`${s} edge`) as HTMLInputElement).checked).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Add roundover' }))
  expect(board().edges).toHaveLength(1)
  expect(screen.getByText('1/4" roundover — top edges (all 4)')).toBeTruthy()
})

test('in the Simple Designer: only roundover and chamfer at 1/8 and 1/4; no turning or taper', () => {
  select('1x6', 5.5, 20, true)
  const profiles = within(screen.getByRole('radiogroup', { name: 'Profile' })).getAllByRole('radio').map(b => b.textContent)
  expect(profiles).toEqual(['Roundover', 'Chamfer'])
  const sizes = within(screen.getByRole('radiogroup', { name: 'Size' })).getAllByRole('radio').map(b => b.textContent)
  expect(sizes).toEqual(['1/8"', '1/4"'])
  expect(screen.queryByText('Turning')).toBeNull()
  expect(screen.queryByText('Taper')).toBeNull()
  expect(screen.getByText(/sand, or router with a grown-up/)).toBeTruthy()
})

test('a profile changed on the drawing board becomes the leg\'s custom shape; deleting it squares the leg', async () => {
  const { draw } = await import('../../src/sketch/drawStore')
  const { editTurning, saveDrawing } = await import('../../src/sketch/ui/session')
  const { deleteSketch } = await import('../../src/model/shaped')
  select('2x2', 1.5, 29)
  fireEvent.click(screen.getByRole('button', { name: 'Turn this leg' }))
  await editTurning(board())
  const sk = draw.getState().sketch
  draw.getState().replace({ ...sk, points: sk.points.map(p => (p.id === 'k2' ? { ...p, y: p.y * 0.9 } : p)) })
  saveDrawing()
  expect(board().turning!.style).toBe('custom')
  studio.getState().apply(p => deleteSketch(p, board().turning!.sketchId))
  expect(board().turning).toBeUndefined()
})
