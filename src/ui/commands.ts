// Every Master Shop command in one list. The toolbar, its menus and the command palette all read from here,
// so a command has one name, one tooltip, one shortcut hint and one place it can be found.
import { worldBox } from '../model/geometry'
import { addBoard, alignBoards, deleteBoards, mirrorBoards, rotateBoard } from '../model/ops'
import { TEMPLATES } from '../templates'
import { studio, type View } from './store'
import { duplicateSelection, groupBoardIds, groupBoards, rotateGroup, ungroup, wholeGroup } from '../assemblies/ops'
import { shop } from '../shop/shopStore'
import { designSession } from '../shop/steps'
import { editShape, newDrawing, openDrawing } from '../sketch/ui/session'
import { openShared } from '../family/ui/ShareDialog'
import { openHelper } from '../smart/ui/SmartDialogs'
import { startImport } from '../exchange/ui/ExchangeDialog'
import { openFinishing } from '../finish/ui/FinishingSchool'
import { openJointDesigner } from '../joinery/ui/JointDesigner'
import { openLibrary } from '../library/ui/Library'
import { openShopTools } from '../tools/ui/ShopTools'
import { goToWorkspace } from './WorkspaceNavigation'

export const COMMAND_GROUPS = ['File', 'Create', 'Modify', 'Joinery', 'Inspect', 'Output', 'Go to'] as const
export type CommandGroup = typeof COMMAND_GROUPS[number]

export type StudioCommand = {
  id: string
  label: string
  keywords: string
  /** Where it lives on the toolbar and in the palette. Optional only so small test lists can leave it out. */
  group?: CommandGroup
  /** The name on its toolbar button or menu item, when shorter than `label`. */
  short?: string
  shortcut?: string
  tooltip?: string
  disabled?: boolean
  run(): void | Promise<unknown>
}

type Def = Omit<StudioCommand, 'group' | 'disabled'> & { disabled?: boolean }

/** The tooltip text with its keyboard shortcut, e.g. "Save the project (Ctrl+S)". */
export function commandHint(c: Pick<StudioCommand, 'label' | 'tooltip' | 'shortcut'>): string {
  const text = c.tooltip ?? c.label
  return c.shortcut ? `${text} (${c.shortcut})` : text
}

export type DialogRequest = { kind: 'group' } | { kind: 'share' } | { kind: 'shared'; message: string }
const askToolbar = (detail: DialogRequest): void => { window.dispatchEvent(new CustomEvent<DialogRequest>('aa:toolbar-dialog', { detail })) }

const AXES = ['x', 'y', 'z'] as const
const SIDE = { min: 'low side', center: 'center', max: 'high side' } as const

export function buildCommands(): StudioCommand[] {
  const s = studio.getState()
  const kids = s.kidsMode
  const sel = s.selection.length > 0
  const sketches = s.project.sketches ?? []
  const whole = kids ? null : wholeGroup(s.project, s.selection)
  const state = () => studio.getState()
  const list: { group: CommandGroup; defs: Def[] }[] = []
  const add = (group: CommandGroup, ...defs: Def[]) => list.push({ group, defs })

  add('File',
    { id: 'new-blank', label: 'New blank project', short: 'Blank project', keywords: 'file start empty', tooltip: 'Start an empty project', run: () => state().newBlank() },
    { id: 'open', label: 'Open project', short: 'Open', keywords: 'file load', tooltip: 'Open a saved project', run: () => state().open() },
    { id: 'save', label: 'Save project', short: 'Save', keywords: 'file write ctrl s', shortcut: 'Ctrl+S', tooltip: 'Save the project', run: () => state().save() },
    { id: 'save-as', label: 'Save project as', short: 'Save As', keywords: 'file copy', tooltip: 'Save the project under a new name', run: () => state().saveAs() },
    { id: 'undo', label: 'Undo', keywords: 'edit back', shortcut: 'Ctrl+Z', tooltip: 'Undo the last change', disabled: !s.canUndo, run: () => state().undo() },
    { id: 'redo', label: 'Redo', keywords: 'edit forward', shortcut: 'Ctrl+Y', tooltip: 'Put back the change you undid', disabled: !s.canRedo, run: () => state().redo() },
    { id: 'share-project', label: 'Share this project', short: 'Share this project…', keywords: 'family send file', tooltip: 'Make a file to share this project', run: () => askToolbar({ kind: 'share' }) },
    { id: 'open-shared', label: 'Open a shared project', short: 'Open a shared project…', keywords: 'family receive file', tooltip: 'Open a project someone shared with you', run: () => void openShared().then(m => { if (m) askToolbar({ kind: 'shared', message: m }) }) },
    { id: 'export-3d', label: 'Export 3D file', short: 'Export…', keywords: 'stl obj step save model', tooltip: 'Save the design as a 3D file', run: () => { state().setView({ exchange: { kind: 'export' } }) } },
    { id: 'import-3d', label: 'Import reference model', short: 'Import reference model…', keywords: 'stl obj bring in 3d file', tooltip: 'Bring in a 3D model to design around', run: () => startImport() },
    ...TEMPLATES.map((t): Def => ({ id: `new-template:${t.id}`, label: `New project from template: ${t.name}`, short: t.name, keywords: 'file start template', tooltip: `Start a ${t.name.toLowerCase()} project`, run: () => state().newFromTemplate(t.id) }))
  )

  add('Create',
    { id: 'add-board', label: 'Add board', keywords: 'new part lumber', tooltip: 'Add a new board next to the others', run: () => addNextBoard() },
    { id: 'cabinet-door', label: 'Make a cabinet door', short: 'Door…', keywords: 'cabinet', tooltip: 'Make a door for a cabinet opening', run: () => { state().setView({ cabinet: 'door' }) } },
    { id: 'cabinet-drawer', label: 'Make a drawer', short: 'Drawer…', keywords: 'cabinet', tooltip: 'Make a drawer box and front', run: () => { state().setView({ cabinet: 'drawer' }) } },
    { id: 'cabinet-frame', label: 'Make a face frame', short: 'Face frame…', keywords: 'cabinet', tooltip: 'Make a face frame for a cabinet', run: () => { state().setView({ cabinet: 'frame' }) } },
    { id: 'cabinet-pins', label: 'Drill shelf pin holes', short: 'Shelf pins…', keywords: 'cabinet holes shelf', tooltip: 'Add shelf pin holes to the selected sides', disabled: s.selection.length < 1 || s.selection.length > 2, run: () => { state().setView({ cabinet: 'pins' }) } },
    { id: 'draw-new', label: 'Start a new drawing', short: 'New drawing', keywords: 'sketch shape outline', tooltip: 'Draw a shape to cut a board to', run: () => newDrawing('precise') },
    ...sketches.map((k): Def => ({ id: `draw-open:${k.id}`, label: `Open drawing: ${k.name}`, short: k.name, keywords: 'sketch shape outline', tooltip: `Open the drawing "${k.name}"`, run: () => openDrawing(k, { boardId: state().project.boards.find(b => b.outline?.sketchId === k.id)?.id ?? null }) })),
    { id: 'edit-shape', label: 'Give the selected board a shape', short: 'Edit shape', keywords: 'sketch outline cut', tooltip: 'Give the selected board a shape', disabled: !oneBoard(), run: () => { const b = oneBoard(); if (b) void editShape(b) } },
    { id: 'pictures', label: 'Open reference pictures', short: '🖼 Pictures', keywords: 'photo trace scale', tooltip: 'Show pictures to design over', run: () => state().setView({ picturesOpen: true }) },
    { id: 'library', label: 'Open library', short: 'Library', keywords: 'species hardware parts reference', tooltip: 'Look up woods, hardware and techniques', run: () => openLibrary('master') },
    { id: 'helper-describe', label: 'Describe a project to a helper', short: 'Describe a project…', keywords: 'smart ai suggest', tooltip: 'Describe what you want to make', run: () => openHelper('describe') },
    { id: 'helper-photo', label: 'Turn a photo into a plan', short: 'Photo → plan…', keywords: 'smart ai trace picture', tooltip: 'Turn a photo into a starting plan', run: () => openHelper('photoPlan') },
    { id: 'helper-wood', label: 'Identify a wood from a photo', short: 'What wood is this?…', keywords: 'smart ai species', tooltip: 'Find out what wood a board is', run: () => openHelper('woodId') },
    { id: 'helper-settings', label: 'Open helper settings', short: 'Settings…', keywords: 'smart ai key', tooltip: 'Smart Helper settings', run: () => openHelper('settings') }
  )

  add('Modify',
    { id: 'duplicate', label: 'Duplicate selection', short: 'Duplicate', keywords: 'copy', shortcut: 'Ctrl+D', tooltip: 'Copy the selected parts', disabled: !sel, run: () => duplicate() },
    ...AXES.map((ax): Def => ({ id: `mirror-${ax}`, label: `Mirror across ${ax.toUpperCase()}`, short: `Mirror across ${ax.toUpperCase()}`, keywords: 'flip copy', tooltip: `Mirror the selected parts across ${ax.toUpperCase()}`, disabled: !sel, run: () => state().apply(p => mirrorBoards(p, state().selection, ax)) })),
    ...AXES.flatMap(ax => (['min', 'center', 'max'] as const).map((m): Def => ({
      id: `align-${ax}-${m}`, label: `Align ${ax.toUpperCase()} ${SIDE[m]}`, short: `${ax.toUpperCase()} ${SIDE[m]}`, keywords: 'line up arrange',
      tooltip: `Line the selected parts up on their ${ax.toUpperCase()} ${SIDE[m]}`, disabled: s.selection.length < 2, run: () => state().apply(p => alignBoards(p, state().selection, ax, m))
    }))),
    ...AXES.map((ax): Def => ({ id: `rotate-${ax}`, label: `Rotate 90° about ${ax.toUpperCase()}`, short: `About ${ax.toUpperCase()}`, keywords: 'turn spin', tooltip: `Turn the selected parts a quarter turn about ${ax.toUpperCase()}`, disabled: !sel, run: () => {
      const st = state()
      const w = kids ? null : wholeGroup(st.project, st.selection)
      st.apply(p => (w ? rotateGroup(p, w.id, ax, 90) : st.selection.reduce((q, id) => rotateBoard(q, id, ax, 90), p)))
    } })),
    { id: 'delete', label: 'Delete selection', short: 'Delete', keywords: 'remove', shortcut: 'Delete', tooltip: 'Delete the selected parts', disabled: !sel, run: () => { const st = state(); st.apply(p => deleteBoards(p, st.selection)); st.select([]) } },
    { id: 'group', label: 'Group selection as assembly', short: 'Group', keywords: 'assembly join together', tooltip: 'Make the selected parts one assembly', disabled: s.selection.length < 2 || !!whole, run: () => askToolbar({ kind: 'group' }) },
    { id: 'ungroup', label: 'Ungroup assembly', short: 'Ungroup', keywords: 'assembly split', tooltip: 'Split the assembly back into parts', disabled: !whole, run: () => { const w = wholeGroup(state().project, state().selection); if (w) state().apply(p => ungroup(p, w.id)) } },
    { id: 'isolate', label: 'Isolate selection', short: 'Isolate', keywords: 'focus hide others', tooltip: 'Show only the selected parts', disabled: !sel && !s.isolated, run: () => { const st = state(); st.isolate(st.isolated ? null : st.selection) } },
    { id: 'show-all', label: 'Show all parts', short: 'Show all', keywords: 'unhide reveal', tooltip: 'Show every part again', disabled: !s.isolated && !s.hidden.some(id => s.project.boards.some(b => b.id === id)), run: () => state().showAll() },
    { id: 'woods', label: 'Open wood library', short: 'Woods', keywords: 'species material lumber', tooltip: 'Choose and edit the woods in this project', run: () => state().set({ woodsOpen: true }) },
    { id: 'finish', label: 'Open finishing schedule', short: 'Finish', keywords: 'stain paint coat', tooltip: 'Plan the finish for this project', run: () => openFinishing('master', 'schedule') }
  )

  add('Joinery',
    { id: 'joint-designer', label: 'Open joint designer', short: 'Joint designer', keywords: 'dado rabbet mortise tenon dovetail', tooltip: 'Design how parts join together', run: () => openJointDesigner('master') }
  )

  add('Inspect',
    { id: 'measure', label: 'Toggle measurement tool', short: 'Measure', keywords: 'distance ruler dimensions', tooltip: 'Click two points to measure between them', run: () => state().set({ measuring: !state().measuring }) },
    ...(['3d', 'front', 'side', 'top'] as const).map((view): Def => ({ id: `view-${view}`, label: `${viewName(view)} view`, short: viewName(view), keywords: 'camera orientation', tooltip: `Look at the design from the ${view === '3d' ? '3D angle' : view}`, run: () => state().set({ view }) })),
    { id: 'fit', label: 'Fit model to view', short: 'Fit', keywords: 'zoom camera extent', tooltip: 'Zoom so the whole design shows', run: () => { window.dispatchEvent(new Event('aa:zoom-fit')) } },
    { id: 'interference', label: 'Inspect interference', short: 'Interference', keywords: 'checks collision overlap', tooltip: 'Find parts that overlap each other', run: () => state().setView({ checksOpen: 'interference' }) },
    { id: 'weight', label: 'Inspect weight and balance', short: 'Weight & balance', keywords: 'checks mass centre', tooltip: 'See how heavy it is and whether it tips', run: () => state().setView({ checksOpen: 'weight' }) },
    { id: 'clearance', label: 'Inspect door and drawer clearance', short: 'Door & drawer clearance', keywords: 'checks motion collision cabinet', tooltip: 'Check doors and drawers can open freely', run: () => state().setView({ checksOpen: 'clearance' }) },
    { id: 'notes', label: 'Open dimensions and notes', short: 'Dimensions & notes', keywords: 'annotation checks', tooltip: 'Pin dimensions and notes to the design', run: () => state().setView({ checksOpen: 'notes' }) },
    { id: 'shop-tools', label: 'Open shop tools', short: 'Shop tools', keywords: 'calculators inventory sag', tooltip: 'Calculators and your tool list', run: () => openShopTools('master') }
  )

  add('Output',
    { id: 'cut-list', label: 'Open cut list', short: 'Cut List', keywords: 'stock materials shopping', tooltip: 'See every board to cut and buy', run: () => state().set({ cutListOpen: true }) },
    { id: 'drawings', label: 'Open drawings', short: kids ? 'Print my plan' : 'Drawings', keywords: 'print sheets plans', tooltip: 'Open the plan sheets to look at or print', run: () => state().set({ drawingsOpen: true }) },
    { id: 'shop-mode', label: 'Start Shop Mode', short: '🪚 Shop Mode', keywords: 'bench steps build', tooltip: 'Big-text steps for the bench', disabled: s.project.boards.length === 0, run: () => shop.getState().open({ ...designSession(state().project, pr => state().setShopProgress(pr)), kid: state().kidsMode }) }
  )

  add('Go to',
    { id: 'go-dashboard', label: 'Go to Dashboard', keywords: 'home start screen', tooltip: 'Go to the Dashboard', run: () => runGoTo('home') },
    { id: 'go-drawing-board', label: 'Go to Drawing Board', keywords: 'sketch screen', tooltip: 'Go to the Drawing Board', run: () => runGoTo('draw') },
    { id: 'go-plans', label: 'Go to My Plans', keywords: 'saved plans screen', tooltip: 'Go to My Plans', run: () => runGoTo('plans') }
  )

  function oneBoard() { return s.selection.length === 1 ? s.project.boards.find(b => b.id === s.selection[0]) : undefined }
  function duplicate() {
    const st = state()
    let ids: string[] = []
    st.apply(p => { const r = duplicateSelection(p, st.selection, !st.kidsMode); ids = r.ids; return r.project })
    st.select(ids)
  }
  function addNextBoard() {
    const st = state()
    st.apply(p => {
      const right = p.boards.length ? Math.max(...p.boards.map(b => worldBox(b).max.x)) + 1 : 0
      const r = addBoard(p, { woodId: p.woods.some(w => w.id === '1x4') ? '1x4' : p.woods[0].id, name: `Board ${p.boards.length + 1}`, position: { x: right, y: 0, z: 0 } })
      setTimeout(() => st.select([r.id]))
      return r.project
    })
  }
  async function runGoTo(target: 'home' | 'draw' | 'plans') {
    const problem = await goToWorkspace(target, state().screen)
    if (problem) state().setError(problem)
  }

  return list.flatMap(({ group, defs }) => defs.map((d): StudioCommand => ({ ...d, group })))
}

const viewName = (v: View) => (v === '3d' ? '3D' : v[0].toUpperCase() + v.slice(1))

/** After a group is named in the toolbar dialog (kept here so the palette and toolbar make groups the same way). */
export function makeGroup(name: string | null) {
  if (!name) return
  const st = studio.getState()
  let id = ''
  st.apply(p => { const r = groupBoards(p, st.selection, name); if ('error' in r) return r; id = r.id; return r.project })
  if (id) st.select(groupBoardIds(studio.getState().project, id))
}

// ---- where each command sits on the toolbar ----

/** A button (`id`), or a drop-down menu listing command ids. An id ending in `*` stands for every command starting with it. */
export type ToolbarEntry =
  | { id: string; name?: string; strong?: boolean; accent?: boolean }
  | { menu: string; title: string; items: string[] }
export type ToolbarSection = { group: CommandGroup; entries: ToolbarEntry[] }

export const TOOLBAR_LAYOUT: ToolbarSection[] = [
  { group: 'File', entries: [
    { menu: 'New', title: 'Start a new project', items: ['new-template:*', 'new-blank'] },
    { id: 'open' }, { id: 'save' }, { id: 'save-as' }, { id: 'undo' }, { id: 'redo' },
    { menu: 'Share', title: 'Share a project with family', items: ['share-project', 'open-shared'] },
    { menu: '3D files', title: 'Export the design or bring in a 3D model', items: ['export-3d', 'import-3d'] }
  ] },
  { group: 'Create', entries: [
    { id: 'add-board' },
    { menu: 'Cabinet', title: 'Doors, drawers, face frames and shelf pins', items: ['cabinet-door', 'cabinet-drawer', 'cabinet-frame', 'cabinet-pins'] },
    { menu: '✏️ Draw a shape', title: 'Draw a shape to cut a board to', items: ['draw-new', 'draw-open:*'] },
    { id: 'edit-shape' }, { id: 'pictures' }, { id: 'library' },
    { menu: '✨ Helpers', title: 'Smart Helpers', items: ['helper-describe', 'helper-photo', 'helper-wood', 'helper-settings'] }
  ] },
  { group: 'Modify', entries: [
    { id: 'duplicate' },
    { menu: 'Mirror', title: 'Mirror the selected parts', items: ['mirror-x', 'mirror-y', 'mirror-z'] },
    { menu: 'Align', title: 'Line up the selected parts', items: ['align-*'] },
    { menu: 'Rotate 90°', title: 'Turn the selected parts a quarter turn', items: ['rotate-x', 'rotate-y', 'rotate-z'] },
    { id: 'delete' }, { id: 'group' }, { id: 'ungroup' }, { id: 'isolate' }, { id: 'show-all' }, { id: 'woods' }, { id: 'finish' }
  ] },
  { group: 'Joinery', entries: [{ id: 'joint-designer' }] },
  { group: 'Inspect', entries: [
    { id: 'measure' }, { id: 'view-3d' }, { id: 'view-front' }, { id: 'view-side' }, { id: 'view-top' }, { id: 'fit' },
    { menu: 'Checks', title: 'Check the design for problems', items: ['interference', 'weight', 'clearance', 'notes'] },
    { id: 'shop-tools' }
  ] },
  { group: 'Output', entries: [{ id: 'cut-list', accent: true }, { id: 'drawings' }, { id: 'shop-mode', strong: true }] }
]

/** The Simple Designer for kids: the same commands, fewer of them. */
export const KIDS_TOOLBAR: ToolbarSection[] = [
  { group: 'File', entries: [{ id: 'new-blank', name: 'New' }, { id: 'open' }, { id: 'save' }, { id: 'save-as' }, { id: 'undo' }, { id: 'redo' }] },
  { group: 'Create', entries: [{ id: 'add-board' }] },
  { group: 'Modify', entries: [
    { id: 'duplicate' },
    { menu: 'Rotate 90°', title: 'Turn the selected parts a quarter turn', items: ['rotate-x', 'rotate-y', 'rotate-z'] },
    { id: 'delete' }
  ] },
  { group: 'Inspect', entries: [{ id: 'view-3d' }, { id: 'view-front' }, { id: 'view-side' }, { id: 'view-top' }, { id: 'fit' }] },
  { group: 'Output', entries: [{ id: 'cut-list', accent: true }, { id: 'drawings' }, { id: 'shop-mode', strong: true }] }
]

/** Expand menus and `prefix*` entries into the command ids a layout shows, in order. */
export function layoutIds(sections: ToolbarSection[], commands: Pick<StudioCommand, 'id'>[]): string[] {
  const expand = (id: string) => (id.endsWith('*') ? commands.filter(c => c.id.startsWith(id.slice(0, -1))).map(c => c.id) : [id])
  return sections.flatMap(sec => sec.entries.flatMap(e => ('menu' in e ? e.items.flatMap(expand) : [e.id])))
}
