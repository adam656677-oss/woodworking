// @vitest-environment jsdom
import { vi } from 'vitest'
vi.hoisted(() => {
  ;(globalThis as any).window = globalThis.window ?? globalThis
  ;(window as any).aa = {
    openProject: async () => null, saveProject: async () => {}, saveAs: async () => null, writeAutosave: async () => {},
    readUntitledAutosave: async () => null, deleteAutosave: async () => {}, exportCsv: async () => null, print: async () => {},
    loadUserWoods: async () => [], saveUserWoods: async () => {}, setDirty: () => {}, setTitle: () => {}, onSaveRequest: () => {}, closeAfterSave: () => {}
  }
})
import { worldBox } from '../../src/model/geometry'
import { emptyProject } from '../../src/model/woods'
import { modeling, parseSigned } from '../../src/modeling/modelStore'
import { studio } from '../../src/ui/store'

const m = () => modeling.getState()
const boards = () => studio.getState().project.boards

beforeEach(() => {
  studio.setState({ project: emptyProject('t'), selection: [], screen: 'master' } as never)
  m().stop()
  m().start()
})

test('rectangle: two clicks, then a typed distance makes a part; undo takes it back', () => {
  m().setTool('rect')
  m().clickAt({ x: 0, y: 0 })
  m().clickAt({ x: 30, y: 12 })
  expect(m().profile).toMatchObject({ kind: 'rect' })
  expect(m().type('3/4')).toBe(true)
  // 3/4 typed with 23/32 plywood: matched to the plywood's real thickness.
  expect(boards()).toHaveLength(1)
  expect(worldBox(boards()[0])).toEqual({ min: { x: 0, y: 0, z: 0 }, max: { x: 30, y: 12, z: 0.71875 } })
  expect(studio.getState().selection).toEqual([boards()[0].id])
  studio.getState().undo()
  expect(boards()).toHaveLength(0)
})

test('rectangle by typed size from the first corner; Enter with no distance uses the wood thickness', () => {
  m().setTool('rect')
  m().clickAt({ x: 2, y: 3 })
  m().hoverAt({ x: 10, y: 10 })
  expect(m().type('24 x 12')).toBe(true)
  expect(m().finishPull()).toBe(true)
  expect(worldBox(boards()[0])).toEqual({ min: { x: 2, y: 3, z: 0 }, max: { x: 26, y: 15, z: 0.71875 } })
})

test('circle with a typed radius, pulled 1-1/2', () => {
  m().setTool('circle')
  m().clickAt({ x: 10, y: 10 })
  m().type('6')
  m().type('1-1/2')
  expect(boards()[0]).toMatchObject({ width: 12, length: 12, thickness: 1.5 })
  expect(boards()[0].outline).toBeTruthy()
})

test('outline by typed lengths and offsets, closed by typing back to the start', () => {
  m().setTool('outline')
  m().type('0,0')
  m().type('20@0')
  m().type('0,4')
  m().type('-16,0')
  m().type('0,8')
  m().type('-4,0')
  expect(m().pts).toHaveLength(6)
  m().type('0,-12')
  expect(m().profile).toMatchObject({ kind: 'poly' })
  m().type('3/4')
  expect(boards()[0]).toMatchObject({ width: 12, length: 20 })
})

test('sketching on a part face and pulling into it cuts through it', () => {
  m().setTool('rect')
  m().clickAt({ x: 0, y: 0 }); m().clickAt({ x: 30, y: 12 }); m().type('3/4')
  const id = boards()[0].id
  m().setTool('face')
  m().pickFace(id, 'z', 'max')
  expect(m().planeKind).toBe('face')
  m().clickAt({ x: 13, y: 5 }); m().clickAt({ x: 17, y: 7 })
  expect(m().type('-1')).toBe(true)
  expect(boards()).toHaveLength(1)
  expect(boards()[0].outline).toBeTruthy()
})

test('push/pull a face by a typed amount', () => {
  m().setTool('rect')
  m().clickAt({ x: 0, y: 0 }); m().clickAt({ x: 30, y: 12 }); m().type('3/4')
  const id = boards()[0].id
  m().setTool('pushpull')
  m().pickFace(id, 'x', 'max')
  expect(m().type('6')).toBe(true)
  expect(worldBox(boards()[0]).max.x).toBe(36)
})

test('a block is offered for splitting; a thin part is not', () => {
  m().setTool('rect')
  m().clickAt({ x: 0, y: 0 }); m().clickAt({ x: 30, y: 12 }); m().type('36')
  expect(m().message).toMatch(/Split into panels/)
  expect(m().splitSelected()).toBe(true)
  expect(m().splitId).toBe(boards()[0].id)
  expect(studio.getState().cabinet).toBe('case')
})

test('mistakes are explained, not applied', () => {
  m().setTool('rect')
  m().clickAt({ x: 0, y: 0 })
  expect(m().type('banana')).toBe(false)
  expect(m().error).toBe(true)
  m().clickAt({ x: 0, y: 5 })
  expect(m().message).toMatch(/width and height/)
  expect(boards()).toHaveLength(0)
  expect(parseSigned('-1-1/2')).toBe(-1.5)
})
