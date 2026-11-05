// The one list of keyboard (and mouse) shortcuts the Help window shows.
//
// The handlers themselves stay where they are in the app. Every entry here says which file handles it and a piece
// of text that must be in that file (`handlers`); tests/help/shortcuts.test.ts checks those pieces are still there,
// and that no file with a keyboard handler is missing from this list. If you change a key in the app, change it
// here too; if you add a key handler, add it here.

export const AREAS = ['Everywhere', 'Design screen', '3D view and parts list', 'Drawing Board', 'Shop Mode', 'Menus, panels and boxes'] as const
export type Area = typeof AREAS[number]

export type Shortcut = {
  id: string
  /** The keys as shown. More than one means any of them works. */
  keys: string[]
  /** What it does, in plain words. */
  does: string
  area: Area
  /** True when it also works in the kids' Simple Designer. */
  kids?: boolean
  /** The files that handle it, and text each must contain. */
  handlers: { file: string; has: string[] }[]
}

const D = 'src/ui/designer/Designer.tsx'

export const DRAWING_TOOL_KEYS: Record<string, { tool: string; name: string }> = {
  L: { tool: 'line', name: 'Line' },
  R: { tool: 'rect', name: 'Rectangle' },
  A: { tool: 'arc3', name: 'Arc (3 points)' },
  C: { tool: 'circle', name: 'Circle' },
  S: { tool: 'spline', name: 'Curve' },
  T: { tool: 'text', name: 'Text' },
  D: { tool: 'dimension', name: 'Dimension' }
}

export const SHORTCUTS: Shortcut[] = [
  { id: 'help', keys: ['F1'], does: 'Open Help for the screen you are on.', area: 'Everywhere', kids: true,
    handlers: [{ file: 'src/help/ui/HelpHost.tsx', has: ["'F1'"] }] },
  { id: 'close-window', keys: ['Esc'], does: 'Close the window that is open (Help, Drawings, Build plan, Share, Smart Helpers, Save a picture).', area: 'Everywhere', kids: true,
    handlers: [
      { file: 'src/help/ui/HelpHost.tsx', has: ["'Escape'"] },
      { file: 'src/drawings/ui/DrawingsDialog.tsx', has: ["e.key === 'Escape'"] },
      { file: 'src/drawings/ui/BuildPlanAction.tsx', has: ["event.key === 'Escape'"] },
      { file: 'src/family/ui/ShareDialog.tsx', has: ["e.key === 'Escape'"] },
      { file: 'src/family/ui/BackupBar.tsx', has: ["e.key === 'Escape'"] },
      { file: 'src/smart/ui/SmartDialogs.tsx', has: ["e.key === 'Escape'"] },
      { file: 'src/render/ui/RenderControls.tsx', has: ["e.key === 'Escape'"] }
    ] },

  { id: 'save', keys: ['Ctrl+S'], does: 'Save the project (Save As the first time).', area: 'Design screen', kids: true,
    handlers: [{ file: D, has: ["e.key.toLowerCase() === 's'", 's.save()'] }] },
  { id: 'undo', keys: ['Ctrl+Z'], does: 'Undo the last change.', area: 'Design screen', kids: true,
    handlers: [{ file: D, has: ["e.key.toLowerCase() === 'z'", 's.undo()'] }] },
  { id: 'redo', keys: ['Ctrl+Y', 'Ctrl+Shift+Z'], does: 'Redo what you just undid.', area: 'Design screen', kids: true,
    handlers: [{ file: D, has: ["e.key.toLowerCase() === 'y'", 's.redo()', 'e.shiftKey'] }] },
  { id: 'duplicate', keys: ['Ctrl+D'], does: 'Copy the selected parts.', area: 'Design screen', kids: true,
    handlers: [{ file: D, has: ["e.key.toLowerCase() === 'd'", 'duplicateSelection'] }] },
  { id: 'delete', keys: ['Delete'], does: 'Delete the selected parts.', area: 'Design screen', kids: true,
    handlers: [{ file: D, has: ["e.key === 'Delete'", 'deleteBoards'] }] },
  { id: 'cancel-tool', keys: ['Esc'], does: 'Stop measuring, or stop placing a note or picking points on a picture.', area: 'Design screen', kids: true,
    handlers: [{ file: D, has: ["e.key === 'Escape'", 'measuring: false'] }] },
  { id: 'palette', keys: ['Ctrl+K'], does: 'Open the command finder: type a few letters, then press Enter to run a command.', area: 'Design screen',
    handlers: [{ file: 'src/ui/designer/CommandPalette.tsx', has: ["event.key.toLowerCase() === 'k'", "event.key === 'Enter'"] }] },

  { id: 'click-part', keys: ['Click'], does: 'Pick a part. Click empty space to pick nothing.', area: '3D view and parts list',
    handlers: [{ file: 'src/ui/three/Scene.tsx', has: ['select(multi', 'onPointerMissed'] }] },
  { id: 'multi-select', keys: ['Ctrl+click', 'Shift+click'], does: 'Add a part to the selection, or take it out again (in the 3D view).', area: '3D view and parts list', kids: true,
    handlers: [{ file: 'src/ui/three/Scene.tsx', has: ['e.nativeEvent.ctrlKey', 'e.nativeEvent.shiftKey'] }] },
  { id: 'list-range', keys: ['Shift+click'], does: 'In the parts list, pick every part from the last one you clicked to this one.', area: '3D view and parts list',
    handlers: [{ file: 'src/ui/designer/PartsList.tsx', has: ['e.shiftKey && anchor'] }] },
  { id: 'list-add', keys: ['Ctrl+click'], does: 'In the parts list, add a part to the selection or take it out.', area: '3D view and parts list',
    handlers: [{ file: 'src/ui/designer/PartsList.tsx', has: ['e.ctrlKey || e.metaKey'] }] },
  { id: 'rename-part', keys: ['Double-click'], does: 'In the parts list, rename a part. Enter keeps the name; Esc leaves it as it was.', area: '3D view and parts list',
    handlers: [{ file: 'src/ui/designer/PartsList.tsx', has: ['onDoubleClick={() => setEditing(b.id)}', "e.key === 'Enter'", "e.key === 'Escape'"] }] },
  { id: 'move-snap-off', keys: ['Alt (hold)'], does: 'While dragging a part by its arrows, turn snapping off for as long as you hold it.', area: '3D view and parts list', kids: true,
    handlers: [{ file: 'src/ui/three/MoveGizmo.tsx', has: ["e.key === 'Alt'", "window.addEventListener('keydown', down)"] }] },
  { id: 'orbit', keys: ['Drag', 'Right-drag', 'Wheel'], does: 'Drag to turn the 3D view, right-drag to slide it, wheel to zoom. Front, Side and Top views zoom and slide but do not turn.', area: '3D view and parts list',
    handlers: [{ file: 'src/ui/three/ViewControls.tsx', has: ['<OrbitControls', "enableRotate={view === '3d'}"] }] },

  ...Object.entries(DRAWING_TOOL_KEYS).map(([key, v]): Shortcut => ({
    id: `draw-tool-${key.toLowerCase()}`, keys: [key], does: `Pick the ${v.name} tool.`, area: 'Drawing Board',
    handlers: [{ file: 'src/sketch/ui/ToolBar.tsx', has: ['export const SHORTCUTS'] }, { file: 'src/sketch/ui/DrawingBoard.tsx', has: ['SHORTCUTS[e.key.toLowerCase()]'] }]
  })),
  { id: 'draw-snap-off', keys: ['Alt (hold)'], does: 'Turn snapping off while you hold it, to place a point exactly where the mouse is.', area: 'Drawing Board',
    handlers: [{ file: 'src/sketch/ui/Canvas.tsx', has: ['snapOff.current = e.altKey'] }] },
  { id: 'draw-esc', keys: ['Esc'], does: 'Stop the shape you are drawing and go back to the Select tool. Press it again to pick nothing.', area: 'Drawing Board',
    handlers: [{ file: 'src/sketch/ui/DrawingBoard.tsx', has: ["e.key === 'Escape'", "s.setTool('select')"] }, { file: 'src/sketch/ui/Canvas.tsx', has: ["e.key === 'Escape'"] }] },
  { id: 'draw-delete', keys: ['Delete', 'Backspace'], does: 'Delete the picked shapes.', area: 'Drawing Board',
    handlers: [{ file: 'src/sketch/ui/DrawingBoard.tsx', has: ["e.key === 'Delete' || e.key === 'Backspace'", 's.remove(s.selection)'] }] },
  { id: 'draw-undo', keys: ['Ctrl+Z', 'Ctrl+Y'], does: 'Undo and redo while drawing.', area: 'Drawing Board',
    handlers: [{ file: 'src/sketch/ui/DrawingBoard.tsx', has: ["e.key.toLowerCase() === 'z'", "e.key.toLowerCase() === 'y'", 's.undo()', 's.redo()'] }] },
  { id: 'draw-type', keys: ['0-9', '.', '/', '-', '@', 'x'], does: 'While drawing a line, rectangle or circle, just start typing a size (11-3/4, @45 for an angle, 10 x 4). Enter uses it.', area: 'Drawing Board',
    handlers: [{ file: 'src/sketch/ui/Canvas.tsx', has: ['[0-9.@\\-/ x]', 'applyTyped'] }] },
  { id: 'draw-curve', keys: ['Enter'], does: 'Finish a curve (it needs at least two points).', area: 'Drawing Board',
    handlers: [{ file: 'src/sketch/ui/Canvas.tsx', has: ["e.key === 'Enter' && tool === 'spline'", 'addSpline'] }] },
  { id: 'draw-zoom', keys: ['Wheel'], does: 'Zoom the drawing sheet in and out.', area: 'Drawing Board',
    handlers: [{ file: 'src/sketch/ui/Canvas.tsx', has: ['const onWheel'] }] },

  { id: 'shop-next', keys: ['Right arrow', 'Page Down', 'Space'], does: 'Go to the next step.', area: 'Shop Mode',
    handlers: [{ file: 'src/shop/ui/ShopMode.tsx', has: ["['ArrowRight', 'PageDown', ' ']"] }] },
  { id: 'shop-back', keys: ['Left arrow', 'Page Up'], does: 'Go back a step.', area: 'Shop Mode',
    handlers: [{ file: 'src/shop/ui/ShopMode.tsx', has: ["['ArrowLeft', 'PageUp']"] }] },
  { id: 'shop-done', keys: ['D'], does: 'Tick the step as done, or take the tick off.', area: 'Shop Mode',
    handlers: [{ file: 'src/shop/ui/ShopMode.tsx', has: ["e.key.toLowerCase() === 'd'", 'toggleDone'] }] },
  { id: 'shop-exit', keys: ['Esc'], does: 'Leave Shop Mode (the ticks and times are kept with the project).', area: 'Shop Mode',
    handlers: [{ file: 'src/shop/ui/ShopMode.tsx', has: ["e.key === 'Escape') exit()"] }] },
  { id: 'shop-save', keys: ['Ctrl+S'], does: 'Save the project. Every other key stays in Shop Mode.', area: 'Shop Mode',
    handlers: [{ file: 'src/shop/ui/ShopMode.tsx', has: ["e.key.toLowerCase() === 's'"] }] },

  { id: 'menu-keys', keys: ['Up arrow', 'Down arrow', 'Home', 'End', 'Esc'], does: 'In an open toolbar menu: move between items, jump to the first or last, or close it.', area: 'Menus, panels and boxes',
    handlers: [{ file: 'src/ui/common/ToolbarMenu.tsx', has: ["'ArrowDown'", "'Home'", "event.key === 'Escape'"] }] },
  { id: 'palette-keys', keys: ['Up arrow', 'Down arrow', 'Enter', 'Esc'], does: 'In the command finder: move through the list, run the highlighted command, or close it.', area: 'Menus, panels and boxes',
    handlers: [{ file: 'src/ui/designer/CommandPalette.tsx', has: ["event.key === 'ArrowDown' || event.key === 'ArrowUp'", "event.key === 'Enter'"] }] },
  { id: 'inspector-tabs', keys: ['Left arrow', 'Right arrow', 'Home', 'End'], does: 'With a tab selected (Properties, Template, References, Checks): move to the next or earlier tab.', area: 'Menus, panels and boxes',
    handlers: [{ file: 'src/ui/designer/InspectorTabs.tsx', has: ["e.key === 'ArrowRight'", "e.key === 'ArrowLeft'", "e.key === 'Home'"] }] },
  { id: 'resize-panel', keys: ['Left arrow', 'Right arrow', 'Shift+arrow', 'Home', 'End'], does: 'With a panel edge selected: make the panel narrower or wider (Shift for bigger steps), or smallest and largest.', area: 'Menus, panels and boxes',
    handlers: [{ file: 'src/ui/designer/WorkspacePanel.tsx', has: ["e.key === 'Home' || e.key === 'End'", 'e.shiftKey ? 40 : 10'] }] },
  { id: 'box-enter', keys: ['Enter'], does: 'In a size or name box: use what you typed.', area: 'Menus, panels and boxes',
    handlers: [
      { file: 'src/ui/designer/InchInput.tsx', has: ["e.key === 'Enter'"] },
      { file: 'src/ui/common/NumberInput.tsx', has: ["e.key !== 'Enter'"] },
      { file: 'src/formulas/ui/FormulaInput.tsx', has: ["e.key === 'Enter'"] },
      { file: 'src/formulas/ui/SizesTab.tsx', has: ["x.key === 'Enter'"] },
      { file: 'src/assemblies/ui/GroupPanel.tsx', has: ["e.key === 'Enter'"] },
      { file: 'src/cabinet/ui/HardwareList.tsx', has: ["e.key === 'Enter'"] },
      { file: 'src/checks/ui/ChecksPanel.tsx', has: ["e.key === 'Enter'"] },
      { file: 'src/optimize/ui/LayoutTab.tsx', has: ["e.key === 'Enter'"] },
      { file: 'src/shop/ui/PicturesPanel.tsx', has: ["e.key === 'Enter'"] },
      { file: 'src/sketch/ui/TracingPicture.tsx', has: ["e.key === 'Enter'"] }
    ] },
  { id: 'box-esc', keys: ['Esc'], does: 'In a size box: put back the size it had before you typed.', area: 'Menus, panels and boxes',
    handlers: [
      { file: 'src/ui/designer/InchInput.tsx', has: ["e.key === 'Escape'"] },
      { file: 'src/ui/common/NumberInput.tsx', has: ["e.key === 'Escape'"] },
      { file: 'src/formulas/ui/FormulaInput.tsx', has: ["e.key === 'Escape'"] }
    ] }
]

/**
 * Files that listen for keys but are deliberately not a separate row above, and why.
 * (A new file with a key handler has to be added to SHORTCUTS or here, or the shortcuts test fails.)
 */
export const KEY_FILES_NOT_LISTED: Record<string, string> = {}

export function shortcutsByArea(list: Shortcut[] = SHORTCUTS): { area: Area; items: Shortcut[] }[] {
  return AREAS.map(area => ({ area, items: list.filter(s => s.area === area) })).filter(g => g.items.length > 0)
}

/** Shortcuts matching every word typed (keys, what it does, or where). */
export function searchShortcuts(query: string, list: Shortcut[] = SHORTCUTS): Shortcut[] {
  const terms = query.toLowerCase().split(/[^\p{L}\p{N}+]+/u).filter(Boolean)
  if (!terms.length) return list
  return list.filter(s => {
    const words = `${s.keys.join(' ')} ${s.does} ${s.area}`.toLowerCase().split(/[^\p{L}\p{N}+]+/u).filter(Boolean)
    return terms.every(t => words.some(w => w.startsWith(t)))
  })
}
