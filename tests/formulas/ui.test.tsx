// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { addBoard } from '../../src/model/ops'
import type { Project } from '../../src/model/types'
import { emptyProject } from '../../src/model/woods'
import { setBoardFormula, setSize } from '../../src/formulas/ops'
import { addRule } from '../../src/formulas/rules'
import { PartsList } from '../../src/ui/designer/PartsList'
import { PropertiesPanel } from '../../src/ui/designer/PropertiesPanel'
import { studio } from '../../src/ui/store'

afterEach(cleanup)
beforeEach(() => { (window as any).aa = { setDirty: () => {} } })
const ok = (r: Project | { error: string }): Project => { if ('error' in r) throw new Error(r.error); return r }

function start(kids = false) {
  studio.setState({ dirty: false })
  const s = studio.getState()
  s.newBlank()
  let a = '', b = ''
  s.apply(p => { const r = addBoard(p, { woodId: '1x6', name: 'Rail', width: 5.5, length: 20 }); a = r.id; return r.project })
  s.apply(p => { const r = addBoard(p, { woodId: '1x6', name: 'Post', width: 5.5, length: 20, position: { x: 30, y: 0, z: 0 } }); b = r.id; return r.project })
  studio.setState({ kidsMode: kids, error: null })
  s.select([a])
  return { a, b }
}
const rail = (id: string) => studio.getState().project.boards.find(x => x.id === id)!
const type = (el: HTMLElement, text: string) => { fireEvent.focus(el); fireEvent.change(el, { target: { value: text } }); fireEvent.keyDown(el, { key: 'Enter' }) }

test('the Sizes tab adds, edits, renames and won\'t delete a size in use', () => {
  const { a } = start()
  render(<PartsList />)
  fireEvent.click(screen.getByRole('tab', { name: 'Sizes' }))
  fireEvent.change(screen.getByLabelText('New size name'), { target: { value: 'W' } })
  fireEvent.change(screen.getByLabelText('New size value'), { target: { value: '30' } })
  fireEvent.click(screen.getByRole('button', { name: 'Add size' }))
  expect(studio.getState().project.sizes).toEqual([{ name: 'W', expr: '30' }])
  expect(screen.getByTestId('result-W').textContent).toBe('30"')
  const v = screen.getByLabelText('Value of W')
  fireEvent.change(v, { target: { value: '24-1/2' } }); fireEvent.blur(v)
  expect(screen.getByTestId('result-W').textContent).toBe('24-1/2"')
  studio.getState().apply(p => setBoardFormula(p, a, 'length', '=W'))
  const n = screen.getByLabelText('Name of W')
  fireEvent.change(n, { target: { value: 'Wide' } }); fireEvent.blur(n)
  expect(rail(a).formulas!.length).toBe('Wide')
  fireEvent.click(screen.getByRole('button', { name: 'Delete Wide' }))
  expect(screen.getByRole('alert').textContent).toBe('Wide is used by: Rail (Length)')
})

test('typing =W/2 sets a formula with ƒ; typing a number over it asks first', () => {
  const { a } = start()
  studio.getState().apply(p => ok(setSize(p, 'W', '30')))
  render(<PropertiesPanel />)
  type(screen.getByLabelText('Width'), '=W/2')
  expect(rail(a).formulas).toEqual({ width: 'W/2' })
  expect(rail(a).width).toBe(15)
  expect(screen.getAllByLabelText('has a formula').length).toBeGreaterThan(0)
  type(screen.getByLabelText('Width'), '8')
  const ask = screen.getByRole('dialog', { name: 'Replace' })
  expect(ask.textContent).toMatch('Replace the formula =W/2 with 8"?')
  fireEvent.click(within(ask).getByRole('button', { name: 'Replace' }))
  expect(rail(a).formulas).toBeUndefined()
  expect(rail(a).width).toBe(8)
})

test('a bad formula shows its message and keeps the size', () => {
  const { a } = start()
  render(<PropertiesPanel />)
  type(screen.getByLabelText('Width'), '=Hight')
  expect(rail(a).width).toBe(5.5)
  expect(screen.getByRole('alert').textContent).toBe("Unknown size 'Hight'")
})

test('Add a rule: each kind; Rules on this part lists and removes them', () => {
  const { a, b } = start()
  let c = ''
  studio.getState().apply(p => { const r = addBoard(p, { woodId: '1x2', name: 'Slat', width: 1.5, length: 20, position: { x: 10, y: 0, z: 0 } }); c = r.id; return r.project })
  studio.getState().select([c])
  render(<PropertiesPanel />)
  const addOne = (fill: () => void) => {
    fireEvent.click(screen.getByRole('button', { name: 'Add a rule' }))
    const d = screen.getByRole('dialog', { name: 'Add a rule' })
    fill()
    fireEvent.click(within(d).getByRole('button', { name: 'Add rule' }))
  }
  addOne(() => {
    fireEvent.change(screen.getByLabelText('Direction'), { target: { value: 'x' } })
    fireEvent.change(screen.getByLabelText('Between'), { target: { value: a } })
    fireEvent.change(screen.getByLabelText('And'), { target: { value: b } })
  })
  addOne(() => {
    fireEvent.change(screen.getByLabelText('Rule'), { target: { value: 'center' } })
    fireEvent.change(screen.getByLabelText('Centered on'), { target: { value: a } })
  })
  addOne(() => {
    fireEvent.change(screen.getByLabelText('Rule'), { target: { value: 'gap' } })
    fireEvent.change(screen.getByLabelText('Direction'), { target: { value: 'y' } })
    fireEvent.change(screen.getByLabelText('From'), { target: { value: a } })
    fireEvent.change(screen.getByLabelText('Gap'), { target: { value: '1/8' } })
  })
  addOne(() => {
    fireEvent.change(screen.getByLabelText('Rule'), { target: { value: 'count' } })
    fireEvent.change(screen.getByLabelText('Direction'), { target: { value: 'x' } })
    fireEvent.change(screen.getByLabelText('Between'), { target: { value: a } })
    fireEvent.change(screen.getByLabelText('And'), { target: { value: b } })
    fireEvent.change(screen.getByLabelText('How many'), { target: { value: '=2' } })
  })
  expect(studio.getState().project.rules!.map(r => r.kind)).toEqual(['spacing', 'center', 'gap', 'count'])
  const list = screen.getByRole('list', { name: 'Rules on this part' })
  expect(within(list).getAllByRole('listitem')).toHaveLength(4)
  fireEvent.click(within(list).getByRole('button', { name: /Remove Centered/ }))
  expect(studio.getState().project.rules!.map(r => r.kind)).toEqual(['spacing', 'gap', 'count'])
})

test('a part placed by a rule asks before a typed move removes the rule', () => {
  const { a, b } = start()
  let c = ''
  studio.getState().apply(p => { const r = addBoard(p, { woodId: '1x2', name: 'Slat', width: 1.5, length: 20, position: { x: 10, y: 0, z: 0 } }); c = r.id; return r.project })
  studio.getState().apply(p => ok(addRule(p, { kind: 'spacing', axis: 'x', from: a, to: b, parts: [c] })))
  studio.getState().select([c])
  render(<PropertiesPanel />)
  type(screen.getByLabelText('X'), '3')
  const ask = screen.getByRole('dialog', { name: 'Replace' })
  expect(ask.textContent).toMatch('This part is placed by a rule (Equal spacing (Slat)). Remove the rule and move it?')
  fireEvent.click(within(ask).getByRole('button', { name: 'Remove the rule' }))
  expect(studio.getState().project.rules ?? []).toEqual([])
})

test('in the Simple Designer: no Sizes tab, plain size boxes', () => {
  start(true)
  render(<><PartsList /><PropertiesPanel /></>)
  expect(screen.queryByRole('tab', { name: 'Sizes' })).toBeNull()
  expect(screen.queryByLabelText('has a formula')).toBeNull()
  type(screen.getByLabelText('Width'), '=3')
  expect(screen.getByRole('alert').textContent).toMatch(/Enter a size/)
})
