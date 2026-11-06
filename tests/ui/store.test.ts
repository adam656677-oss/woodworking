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
    deleteAutosave: async (path: string | null) => { calls.push(`deleteAutosave:${path}`) },
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
  s.getState().apply(unlock)
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
  s.getState().apply(unlock)
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

// ---- Final review fixes ----
import { moveBoard } from '../../src/model/ops'
import { unlock } from '../../src/templates'

test('C1: New with unsaved work asks first; Cancel keeps the work, Don\'t Save replaces it', async () => {
  fakeApi()
  const s = createStudioStore()
  s.getState().newFromTemplate('box')
  s.getState().apply(unlock)
  const work = s.getState().project
  s.getState().newBlank()
  expect(s.getState().pendingReplace).toBe(true)
  expect(s.getState().project).toBe(work)
  await s.getState().resolvePending('cancel')
  expect(s.getState().pendingReplace).toBe(false)
  expect(s.getState().project).toBe(work)
  s.getState().newBlank()
  await s.getState().resolvePending('discard')
  expect(s.getState().project.boards).toEqual([])
  expect(s.getState().dirty).toBe(false)
})

test('C1: Save in the prompt saves, then carries on; a cancelled Save As keeps the work', async () => {
  const calls = fakeApi()
  const s = createStudioStore()
  s.getState().newFromTemplate('box')
  s.getState().apply(unlock)
  s.getState().newBlank()
  await s.getState().resolvePending('save')
  expect(calls).toContain('saveAs')
  expect(s.getState().project.boards).toEqual([])

  fakeApi({ saveAs: async () => null })
  const t = createStudioStore()
  t.getState().newFromTemplate('box')
  t.getState().apply(unlock)
  const work = t.getState().project
  t.getState().newBlank()
  await t.getState().resolvePending('save')
  expect(t.getState().project).toBe(work)
})

test('C1: Open with unsaved work asks first and opens nothing until answered', async () => {
  let opened = 0
  fakeApi({ openProject: async () => { opened++; return null } })
  const s = createStudioStore()
  s.getState().newFromTemplate('box')
  s.getState().apply(unlock)
  await s.getState().open()
  expect(opened).toBe(0)
  expect(s.getState().pendingReplace).toBe(true)
  await s.getState().resolvePending('discard')
  expect(opened).toBe(1)
})

test('C1: a clean project, or an untouched template, is replaced without asking', () => {
  fakeApi()
  const s = createStudioStore()
  s.getState().newBlank()
  s.getState().newFromTemplate('box')
  expect(s.getState().pendingReplace).toBe(false)
  expect(s.getState().project.boards.length).toBeGreaterThan(0)
  s.getState().newFromTemplate('bookshelf')
  expect(s.getState().pendingReplace).toBe(false)
  expect(s.getState().project.name).toBe('Bookshelf')
})

test('I4: a part of a live template cannot be edited directly; the template sizes and Unlock still work', () => {
  fakeApi()
  const s = createStudioStore()
  s.getState().newFromTemplate('box')
  const before = s.getState().project
  const b = before.boards[0]
  s.getState().apply(p => moveBoard(p, b.id, { ...b.position, x: b.position.x + 5 }))
  expect(s.getState().project).toBe(before)
  expect(s.getState().error).toMatch(/Unlock/)
  s.getState().apply(unlock)
  expect(s.getState().project.template).toBeUndefined()
})

test('I9: saving removes the autosave; dismissing an untitled recovery removes it too', async () => {
  const calls = fakeApi({ readUntitledAutosave: async () => '{}' })
  const s = createStudioStore()
  await s.getState().checkUntitledAutosave()
  expect(s.getState().recovery).not.toBeNull()
  s.getState().resolveRecovery(false)
  expect(calls).toContain('deleteAutosave:null')
  s.getState().newFromTemplate('box')
  s.getState().apply(unlock)
  await s.getState().saveAs()
  expect(calls).toContain('deleteAutosave:/docs/Box.aaw')
  expect(calls).toContain('deleteAutosave:null')
})

test('I9: the untitled autosave is checked only once per launch', async () => {
  let reads = 0
  fakeApi({ readUntitledAutosave: async () => { reads++; return null } })
  const s = createStudioStore()
  await s.getState().checkUntitledAutosave()
  await s.getState().checkUntitledAutosave()
  expect(reads).toBe(1)
})

test('the Simple Designer opens a blank project in kids mode; the Master Shop turns kids mode off', () => {
  fakeApi()
  const s = createStudioStore()
  s.getState().enterKidsDesigner()
  expect(s.getState().kidsMode).toBe(true)
  expect(s.getState().screen).toBe('master')
  expect(s.getState().project.boards).toEqual([])
  s.getState().enterMasterShop()
  expect(s.getState().kidsMode).toBe(false)
  expect(s.getState().screen).toBe('master')
})

test("the Simple Designer won't open over a grown-up's unsaved Master Shop work (no way for a kid to discard it)", () => {
  fakeApi()
  const s = createStudioStore()
  s.getState().newFromTemplate('box')
  s.getState().apply(unlock)
  const work = s.getState().project
  expect(s.getState().enterKidsDesigner()).toBe(false)
  expect(s.getState().pendingReplace).toBe(false)
  expect(s.getState().kidsMode).toBe(false)
  expect(s.getState().project).toBe(work)
})

test('opening a live-template project in the Simple Designer unlocks it so it can be edited', async () => {
  const { serialize } = await import('../../src/model/fileFormat')
  const { applyTemplate } = await import('../../src/templates')
  const { emptyProject } = await import('../../src/model/woods')
  const text = serialize(applyTemplate(emptyProject('Box'), 'box'))
  fakeApi({ openProject: async () => ({ path: '/docs/Box.aaw', text, autosaveNewer: false, backupPath: '/docs/Box.aaw.bak' }) })
  const s = createStudioStore()
  expect(s.getState().enterKidsDesigner()).toBe(true)
  await s.getState().open()
  expect(s.getState().kidsMode).toBe(true)
  expect(s.getState().project.template).toBeUndefined()
  expect(s.getState().project.boards.length).toBeGreaterThan(0)
})

test("a plan's attached design opens in the Master Shop as an unsaved copy", async () => {
  const { serialize } = await import('../../src/model/fileFormat')
  const { applyTemplate } = await import('../../src/templates')
  const { emptyProject } = await import('../../src/model/woods')
  fakeApi()
  const s = createStudioStore()
  s.getState().openDesignText(serialize(unlock(applyTemplate(emptyProject('Stool'), 'box'))))
  expect(s.getState().screen).toBe('master')
  expect(s.getState().kidsMode).toBe(false)
  expect(s.getState().filePath).toBeNull()
  expect(s.getState().project.boards.length).toBeGreaterThan(0)
})

test('a damaged autosave never blocks opening: the last saved version opens with a plain message', async () => {
  const { serialize } = await import('../../src/model/fileFormat')
  const { applyTemplate } = await import('../../src/templates')
  const { emptyProject } = await import('../../src/model/woods')
  const saved = serialize(applyTemplate(emptyProject('Box'), 'box'))
  fakeApi({
    openProject: async () => ({ path: '/docs/Box.aaw', text: saved, autosaveNewer: true, autosaveText: '{"half a fi', backupPath: '/docs/Box.aaw.bak' })
  })
  const s = createStudioStore()
  await s.getState().open()
  expect(s.getState().recovery).not.toBeNull()
  s.getState().resolveRecovery(true)
  await Promise.resolve()
  expect(s.getState().screen).toBe('master')
  expect(s.getState().filePath).toBe('/docs/Box.aaw')
  expect(s.getState().dirty).toBe(false)
  expect(s.getState().error).toMatch(/recovered copy was damaged.*last saved version/i)
})

test('a damaged untitled autosave is cleared with a plain message instead of coming back every launch', async () => {
  const calls = fakeApi({ readUntitledAutosave: async () => '{"half a fi' })
  const s = createStudioStore()
  await s.getState().checkUntitledAutosave()
  s.getState().resolveRecovery(true)
  await Promise.resolve()
  expect(s.getState().recovery).toBeNull()
  expect(s.getState().error).toMatch(/recovered copy was damaged/i)
  expect(calls).toContain('deleteAutosave:null')
})
