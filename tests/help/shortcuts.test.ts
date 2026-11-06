import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { AREAS, DRAWING_TOOL_KEYS, KEY_FILES_NOT_LISTED, SHORTCUTS, shortcutsByArea } from '../../src/help/shortcuts'
import { SHORTCUTS as DRAW_TOOL_SHORTCUTS } from '../../src/sketch/ui/ToolBar'

const root = process.cwd()
const read = (file: string) => readFileSync(join(root, file), 'utf8')
const squash = (s: string) => s.replace(/\s+/g, ' ')

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(f => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? sourceFiles(p) : /\.(ts|tsx)$/.test(p) ? [p] : []
  })
}

it('every listed shortcut has a real handler in the source', () => {
  for (const s of SHORTCUTS) {
    expect(s.handlers.length, s.id).toBeGreaterThan(0)
    for (const h of s.handlers) {
      const text = squash(read(h.file))
      for (const snippet of h.has) expect(text.includes(squash(snippet)), `${s.id}: ${h.file} should contain ${snippet}`).toBe(true)
    }
  }
})

it('ids are unique and each shortcut says what it does, where, and with which keys', () => {
  expect(new Set(SHORTCUTS.map(s => s.id)).size).toBe(SHORTCUTS.length)
  for (const s of SHORTCUTS) {
    expect(s.keys.length, s.id).toBeGreaterThan(0)
    expect(s.does.length, s.id).toBeGreaterThan(5)
    expect(AREAS).toContain(s.area)
  }
})

it('the Drawing Board tool letters match the ones the board really uses', () => {
  const listed = Object.fromEntries(Object.entries(DRAWING_TOOL_KEYS).map(([key, v]) => [key.toLowerCase(), v.tool]))
  expect(listed).toEqual(DRAW_TOOL_SHORTCUTS)
  for (const key of Object.keys(DRAWING_TOOL_KEYS)) {
    const s = SHORTCUTS.find(x => x.id === `draw-tool-${key.toLowerCase()}`)
    expect(s, key).toBeDefined()
    expect(s!.keys).toEqual([key])
  }
})

it('every file with a keyboard handler is either listed or knowingly left out', () => {
  const listed = new Set(SHORTCUTS.flatMap(s => s.handlers.map(h => h.file)))
  const skipped = new Set(Object.keys(KEY_FILES_NOT_LISTED))
  const found = sourceFiles(join(root, 'src'))
    .map(f => relative(root, f).split('\\').join('/'))
    .filter(f => !f.startsWith('src/help/'))
    .filter(f => /keydown|onKeyDown/i.test(read(f)))
  const unknown = found.filter(f => !listed.has(f) && !skipped.has(f))
  expect(unknown, 'New keyboard handler: add it to src/help/shortcuts.ts (SHORTCUTS or KEY_FILES_NOT_LISTED)').toEqual([])
  const stale = [...skipped].filter(f => !found.includes(f))
  expect(stale, 'These files no longer have a keyboard handler').toEqual([])
  for (const [file, why] of Object.entries(KEY_FILES_NOT_LISTED)) expect(why.length, file).toBeGreaterThan(10)
})

it('groups by area in a fixed order and drops nothing', () => {
  const groups = shortcutsByArea()
  expect(groups.map(g => g.area)).toEqual(AREAS.filter(a => SHORTCUTS.some(s => s.area === a)))
  expect(groups.flatMap(g => g.items).length).toBe(SHORTCUTS.length)
})

it('lists the keys people most expect', () => {
  const keys = SHORTCUTS.flatMap(s => s.keys)
  for (const k of ['Ctrl+S', 'Ctrl+Z', 'Ctrl+Y', 'Ctrl+D', 'Delete', 'Esc', 'Ctrl+K', 'F1']) expect(keys, k).toContain(k)
})
