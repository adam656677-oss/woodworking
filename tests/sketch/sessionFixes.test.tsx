// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { addBoard } from '../../src/model/ops'
import { addSketch, shapeBoard } from '../../src/model/shaped'
import { emptyProject } from '../../src/model/woods'
import { draw } from '../../src/sketch/drawStore'
import { initSolver } from '../../src/sketch/solver'
import { Outputs } from '../../src/sketch/ui/Outputs'
import { editShape, flushDrawing } from '../../src/sketch/ui/session'
import { PropertiesPanel } from '../../src/ui/designer/PropertiesPanel'
import { studio } from '../../src/ui/store'
import { apron } from './fixtures'

beforeAll(async () => { await initSolver() })
afterEach(cleanup)
const dirtyCalls: boolean[] = []
beforeEach(() => {
  dirtyCalls.length = 0
  ;(window as any).aa = { setDirty: (d: boolean) => dirtyCalls.push(d), print: async () => {} }
  ;(globalThis as any).ResizeObserver ??= class { observe() {} disconnect() {} }
})

test('a drawing in progress goes into the project before a save or autosave, and marks the window unsaved', () => {
  studio.setState({ project: emptyProject('T'), screen: 'draw', error: null })
  draw.getState().begin(apron(), { isNew: true })
  draw.getState().addLine({ x: 40, y: 0 }, { x: 41, y: 0 })
  expect(dirtyCalls).toContain(true)
  flushDrawing()
  expect(studio.getState().project.sketches?.[0].entities).toHaveLength(5)
  expect(studio.getState().dirty).toBe(true)
})

test('Edit shape left without changes keeps no extra drawing', async () => {
  const r = addBoard(emptyProject('T'), { woodId: '1x6', name: 'Rail', width: 4, length: 20 })
  studio.setState({ project: r.project, screen: 'master', error: null })
  await editShape(r.project.boards[0])
  flushDrawing()
  expect(studio.getState().project.sketches ?? []).toEqual([])
})

test('a drawing can be deleted; its parts become rectangles', () => {
  const s = shapeBoard(addSketch(emptyProject('T'), apron()), null, 'k1', '1x6')
  if ('error' in s) throw new Error(s.error)
  studio.setState({ project: s.project, screen: 'draw', error: null })
  draw.getState().begin(apron(), { boardId: s.id })
  render(<Outputs />)
  fireEvent.click(screen.getByRole('button', { name: 'Delete drawing' }))
  expect(studio.getState().project.sketches).toEqual([])
  expect(studio.getState().project.boards[0].outline).toBeUndefined()
  expect(studio.getState().screen).toBe('master')
})

test('a shaped part can be made a rectangle again from its properties', () => {
  const s = shapeBoard(addSketch(emptyProject('T'), apron()), null, 'k1', '1x6')
  if ('error' in s) throw new Error(s.error)
  studio.setState({ project: s.project, selection: [s.id], screen: 'master', error: null })
  render(<PropertiesPanel />)
  fireEvent.click(screen.getByRole('button', { name: 'Make it a rectangle again' }))
  expect(studio.getState().project.boards[0].outline).toBeUndefined()
  expect(studio.getState().project.boards[0]).toMatchObject({ width: 4, length: 30 })
})
