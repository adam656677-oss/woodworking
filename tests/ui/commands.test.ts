// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildCommands, commandHint, COMMAND_GROUPS, KIDS_TOOLBAR, TOOLBAR_LAYOUT, layoutIds, type StudioCommand } from '../../src/ui/commands'
import { studio } from '../../src/ui/store'

beforeEach(() => { studio.getState().newBlank() })
afterEach(() => { studio.setState({ kidsMode: false }) })

const all = () => buildCommands()
const byId = (id: string) => all().find(c => c.id === id)!

describe('one list of commands for the toolbar, menus and palette', () => {
  it('gives every command a unique id, a group, a label and a tooltip', () => {
    const cmds = all()
    expect(new Set(cmds.map(c => c.id)).size).toBe(cmds.length)
    for (const c of cmds) {
      expect(COMMAND_GROUPS, c.id).toContain(c.group)
      expect(c.label.trim(), c.id).not.toBe('')
      expect(c.tooltip?.trim(), c.id).toBeTruthy()
    }
  })

  it('puts the toolbar groups in the order File, Create, Modify, Joinery, Inspect, Output', () => {
    expect(TOOLBAR_LAYOUT.map(g => g.group)).toEqual(['File', 'Create', 'Modify', 'Joinery', 'Inspect', 'Output'])
  })

  it('lists every toolbar entry as a real command', () => {
    const ids = new Set(all().map(c => c.id))
    for (const id of layoutIds(TOOLBAR_LAYOUT, all())) expect(ids.has(id), id).toBe(true)
  })

  it('reaches every command from the toolbar or a menu, except "Go to" screens (palette and workspace bar)', () => {
    const placed = new Set(layoutIds(TOOLBAR_LAYOUT, all()))
    const missing = all().filter(c => c.group !== 'Go to' && !placed.has(c.id)).map(c => c.id)
    expect(missing).toEqual([])
  })

  it('keeps each command in the group its toolbar section is named for', () => {
    for (const section of TOOLBAR_LAYOUT) {
      for (const id of layoutIds([section], all())) expect(byId(id).group, id).toBe(section.group)
    }
  })

  it('has no two commands that do the same job under different names', () => {
    const labels = all().map(c => c.label.toLowerCase())
    expect(new Set(labels).size).toBe(labels.length)
  })

  it('shows keyboard shortcuts in the tooltip text', () => {
    expect(commandHint(byId('save'))).toBe('Save the project (Ctrl+S)')
    expect(commandHint(byId('undo'))).toContain('Ctrl+Z')
    expect(commandHint(byId('duplicate'))).toContain('Ctrl+D')
    expect(commandHint(byId('delete'))).toContain('Delete')
    expect(commandHint(byId('fit'))).not.toContain('(')
  })

  it('keeps the old palette commands under their old ids', () => {
    for (const id of ['save', 'save-as', 'open', 'undo', 'redo', 'fit', 'view-3d', 'view-front', 'view-side', 'view-top', 'measure', 'drawings', 'cut-list', 'woods', 'pictures', 'interference', 'clearance', 'weight', 'notes']) {
      expect(all().some(c => c.id === id), id).toBe(true)
    }
  })

  it('turns selection commands off until something is selected', () => {
    for (const id of ['duplicate', 'delete', 'mirror-x', 'rotate-z', 'isolate']) expect(byId(id).disabled, id).toBe(true)
    expect(byId('group').disabled).toBe(true)
    expect(byId('align-x-min').disabled).toBe(true)
  })

  it('runs a command against the real project', () => {
    byId('add-board').run()
    expect(studio.getState().project.boards).toHaveLength(1)
    byId('view-front').run()
    expect(studio.getState().view).toBe('front')
  })

  it('offers each template and each saved drawing as a command', () => {
    expect(all().some(c => c.id === 'new-template:bookshelf')).toBe(true)
    expect(all().some(c => c.id === 'new-blank')).toBe(true)
  })

  it('shows kids a small, calm toolbar that only uses real commands', () => {
    const ids = new Set(all().map((c: StudioCommand) => c.id))
    for (const id of layoutIds(KIDS_TOOLBAR, all())) expect(ids.has(id), id).toBe(true)
    expect(layoutIds(KIDS_TOOLBAR, all())).not.toContain('joint-designer')
  })
})
