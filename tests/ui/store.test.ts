// @vitest-environment jsdom
import { addBoard, renameBoard } from '../../src/model/ops'
import { createStudioStore } from '../../src/ui/store'

function fakeApi(over: Record<string, unknown> = {}) {
  const calls: string[] = []
  const api = {
    openProject: async () => null,
    saveProject: async () => { calls.push('saveProject') },
    saveAs: async () => { calls.push('saveAs'); return '/docs/Box.aaw' },
    writeAutosave: async () => { calls.push('autosave') },
    readUntitledAutosave: async () => null,
    exportCsv: async () => null,
    print: async () => {},
    loadUserWoods: async () => [],
    saveUserWoods: async () => { calls.push('saveUserWoods') },
    setDirty: () => {},
    setTitle: () => {},
    onSaveRequest: () => {},
    closeAfterSave: () => {},
    ...over
  }
  ;(window as any).aa = api
  return calls
}

test('apply then undo restores the project and the selection; redo re-applies', () => {
  fakeApi()
  const s = createStudioStore()
  s.getState().newFromTemplate('box')
  const first = s.getState().project.boards[0]
  s.getState().select([first.id])
  s.getState().apply(p => renameBoard(p, first.id, 'Lid'))
  s.getState().select([])
  expect(s.getState().project.boards[0].name).toBe('Lid')
  expect(s.getState().dirty).toBe(true)
  s.getState().undo()
  expect(s.getState().project.boards[0].name).toBe('Front')
  expect(s.getState().selection).toEqual([first.id])
  s.getState().redo()
  expect(s.getState().project.boards[0].name).toBe('Lid')
})

test('an operation error is shown and changes nothing', () => {
  fakeApi()
  const s = createStudioStore()
  s.getState().newBlank()
  const before = s.getState().project
  s.getState().apply(() => ({ error: "These boards don't touch" }))
  expect(s.getState().project).toBe(before)
  expect(s.getState().error).toBe("These boards don't touch")
})

test('warnings are recomputed after every change', () => {
  fakeApi()
  const s = createStudioStore()
  s.getState().newBlank()
  s.getState().apply(p => addBoard(p, { woodId: '1x6', length: 200 }).project)
  expect(s.getState().warnings.map(w => w.kind)).toEqual(['exceedsStock'])
})

test('save as, then save; dirty clears', async () => {
  const calls = fakeApi()
  const s = createStudioStore()
  s.getState().newFromTemplate('box')
  expect(s.getState().dirty).toBe(true)
  await s.getState().save()
  expect(calls).toContain('saveAs')
  expect(s.getState().filePath).toBe('/docs/Box.aaw')
  expect(s.getState().dirty).toBe(false)
  s.getState().apply(p => renameBoard(p, p.boards[0].id, 'X'))
  await s.getState().save()
  expect(calls.filter(c => c === 'saveProject')).toHaveLength(1)
  expect(s.getState().dirty).toBe(false)
})

test('the project name follows the file name on Save As and on Open', async () => {
  const written: string[] = []
  fakeApi({
    saveAs: async (text: string) => { written.push(text); return 'C:\\Docs\\My Shelf.aaw' },
    saveProject: async (_p: string, text: string) => { written.push(text) }
  })
  const s = createStudioStore()
  s.getState().newFromTemplate('bookshelf')
  await s.getState().saveAs()
  expect(s.getState().project.name).toBe('My Shelf')
  expect(JSON.parse(written[written.length - 1]).name).toBe('My Shelf')

  const text = written[0] // a file whose stored name is still "Bookshelf"
  fakeApi({ openProject: async () => ({ path: '/docs/Renamed.aaw', text, autosaveNewer: false, backupPath: '/docs/Renamed.aaw.bak' }) })
  await s.getState().open()
  expect(s.getState().project.name).toBe('Renamed')
})

test('a user wood joins new projects and is copied into a project when used', async () => {
  const saved: unknown[] = []
  fakeApi({ saveUserWoods: async (w: unknown) => { saved.push(w) } })
  const s = createStudioStore()
  await s.getState().addUserWood({ name: 'Walnut 4/4', species: 'Walnut', kind: 'hardwood', thickness: 0.8125, width: 7, length: 72 })
  expect(saved).toHaveLength(1)
  s.getState().newBlank()
  const walnut = s.getState().project.woods.find(w => w.name === 'Walnut 4/4')!
  expect(walnut).toMatchObject({ builtIn: false, thickness: 0.8125 })
  s.getState().apply(p => addBoard(p, { woodId: walnut.id }).project)
  expect(s.getState().project.boards[0].thickness).toBe(0.8125)
})
