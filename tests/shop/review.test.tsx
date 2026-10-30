// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react'
import { vi } from 'vitest'
import { createStudioStore } from '../../src/ui/store'
import { addBoard } from '../../src/model/ops'
import { ShopMode } from '../../src/shop/ui/ShopMode'
import { shop } from '../../src/shop/shopStore'
import { emptyProgress, jointStep } from '../../src/shop/steps'
import { createDrawStore } from '../../src/sketch/drawStore'
import { newSketch } from '../../src/sketch/types'
import { isPlan, newPlan } from '../../src/plans/types'

afterEach(() => { cleanup(); act(() => shop.getState().close()) })
beforeEach(() => { (window as any).aa = { setDirty: () => {}, keepAwake: async () => {} } })

test('Shop Mode ticks survive undo and redo of design changes', () => {
  const s = createStudioStore()
  s.getState().newBlank()
  s.getState().apply(p => addBoard(p, { woodId: '1x6', name: 'Rail', width: 5.5, length: 20 }).project)
  s.getState().apply(p => ({ ...p, boards: p.boards.map(b => ({ ...b, name: 'Top rail' })) }))
  s.getState().setShopProgress({ done: ['cut'], minutes: { cut: 5 } })
  s.getState().undo()
  expect(s.getState().project.shopProgress).toEqual({ done: ['cut'], minutes: { cut: 5 } })
  s.getState().setShopProgress({ done: ['cut', 'final'], minutes: {} })
  s.getState().redo()
  expect(s.getState().project.shopProgress).toEqual({ done: ['cut', 'final'], minutes: {} })
})

test('keys pressed in Shop Mode do not reach the screen underneath', () => {
  const under = vi.fn()
  window.addEventListener('keydown', under)
  render(<ShopMode />)
  act(() => shop.getState().open({ title: 'T', steps: [{ key: 'a', title: 'A', text: 'a', tools: [], parts: [] }, { key: 'b', title: 'B', text: 'b', tools: [], parts: [] }], progress: emptyProgress(), kid: false, save: () => {} }))
  act(() => { document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true })) })
  act(() => { document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true })) })
  expect(under).not.toHaveBeenCalled()
  window.removeEventListener('keydown', under)
})

test('held keys do not race through steps; D ticks the step', () => {
  const save = vi.fn()
  const { getByTestId } = render(<ShopMode />)
  act(() => shop.getState().open({ title: 'T', steps: ['a', 'b', 'c'].map(k => ({ key: k, title: k, text: k, tools: [], parts: [] })), progress: emptyProgress(), kid: false, save }))
  act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' })) })
  act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', repeat: true })) })
  expect(getByTestId('step-count').textContent).toBe('Step 2 of 3')
  act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd' })) })
  expect(save).toHaveBeenLastCalledWith({ done: ['b'], minutes: {} })
})

test('starting to pick scale points on the drawing board switches to the select tool', () => {
  const d = createDrawStore()
  d.getState().begin(newSketch('k', 'A', 'precise'))
  d.getState().setTool('line')
  d.getState().setRefPick([])
  expect(d.getState().tool).toBe('select')
})

test('a damaged plan progress is dropped when the plan loads; rabbet wording tolerates tiny offsets', () => {
  const plan = { ...newPlan('P', 'p1'), progress: { done: null } }
  expect(isPlan(plan)).toBe(true)
  expect((plan as { progress?: unknown }).progress).toBeUndefined()
  const p = { boards: [{ id: 'h', name: 'Side' }, { id: 'q', name: 'Back' }] } as never
  const j = { id: 'j', type: 'rabbet', hostBoardId: 'h', partnerBoardId: 'q', params: { offset: 1e-9, width: 0.25, depth: 0.375, face: 'top', along: 'length' } } as never
  expect(jointStep(p, j).text).toContain('along the near edge')
})
