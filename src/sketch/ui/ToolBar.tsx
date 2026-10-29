import { draw, useDraw, type Tool } from '../drawStore'

const DRAW: [Tool, string, string, string?][] = [
  ['select', '↖', 'Select', 'Esc'],
  ['line', '╱', 'Line', 'L'],
  ['rect', '▭', 'Rectangle', 'R'],
  ['arc3', '◠', 'Arc (3 points)', 'A'],
  ['arcCenter', '◜', 'Arc (centre)'],
  ['circle', '◯', 'Circle', 'C'],
  ['spline', '∿', 'Curve', 'S'],
  ['text', 'A', 'Text', 'T'],
  ['construction', '┄', 'Guide line']
]
const MODIFY: [Tool, string, string, string?][] = [
  ['dimension', '↔', 'Dimension', 'D'],
  ['trim', '✂', 'Trim'],
  ['extend', '⟶', 'Extend'],
  ['fillet', '╮', 'Round a corner'],
  ['chamfer', '◸', 'Chamfer a corner'],
  ['mirror', '⇋', 'Mirror']
]

export const SHORTCUTS: Record<string, Tool> = { l: 'line', r: 'rect', a: 'arc3', c: 'circle', s: 'spline', t: 'text', d: 'dimension' }

export const HINTS: Record<Tool, string> = {
  select: 'Click to pick a shape or point (Shift for more); drag a point to move it; drag the sheet to look around.',
  line: 'Click where the line starts, then each corner. Type a length (11-3/4) or angle (@45). Esc to stop.',
  rect: 'Click one corner, then the opposite corner — or type a size like 10 x 4.',
  arc3: 'Click where the arc starts, where it ends, then a point it passes through.',
  arcCenter: 'Click the centre, where the arc starts, then where it ends (it runs counter-clockwise).',
  circle: 'Click the centre, then the edge — or type the radius.',
  spline: 'Click points for the curve to pass through. Double-click or Enter to finish.',
  text: 'Click where the text starts.',
  construction: 'Guide lines help line things up. They are not cut.',
  dimension: 'Click a line, circle or arc — or two points. For an angle, select one line and Shift-click another.',
  trim: 'Click the piece of a shape to cut away, up to where it crosses another.',
  extend: 'Click the line to lengthen, then what it should reach.',
  offset: 'Select shapes first, then Offset to draw a copy a set distance away.',
  mirror: 'Select what to mirror, then choose Mirror and click the line to mirror across.',
  fillet: 'Click a corner (orange) to round it.',
  chamfer: 'Click a corner (orange) to cut it off straight.',
  freehand: 'Draw with your finger or the mouse.'
}

function ToolButton({ t, icon, label, keyName }: { t: Tool; icon: string; label: string; keyName?: string }) {
  const tool = useDraw(s => s.tool)
  return (
    <button
      aria-pressed={tool === t}
      title={keyName ? `${label} (${keyName})` : label}
      onClick={() => draw.getState().setTool(t)}
      className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm ${tool === t ? 'bg-amber-700 text-white' : 'hover:bg-stone-200'}`}
    >
      <span className="w-5 text-center text-base leading-none">{icon}</span>{label}
    </button>
  )
}

export function ToolBar({ onOffset }: { onOffset(): void }) {
  const selection = useDraw(s => s.selection)
  const canUndo = useDraw(s => s.past.length > 0)
  const canRedo = useDraw(s => s.future.length > 0)
  const s = draw.getState()
  return (
    <nav aria-label="Drawing tools" className="flex w-44 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-stone-300 bg-white p-2">
      <h2 className="px-1 text-xs font-semibold uppercase text-stone-500">Draw</h2>
      {DRAW.map(([t, i, l, k]) => <ToolButton key={t} t={t} icon={i} label={l} keyName={k} />)}
      <h2 className="mt-2 px-1 text-xs font-semibold uppercase text-stone-500">Change</h2>
      {MODIFY.map(([t, i, l, k]) => <ToolButton key={t} t={t} icon={i} label={l} keyName={k} />)}
      <button title="Offset" onClick={onOffset} className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-stone-200">
        <span className="w-5 text-center text-base leading-none">⧉</span>Offset
      </button>
      <button disabled={!selection.length} onClick={() => s.remove(selection)} className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-stone-200 disabled:opacity-40">
        <span className="w-5 text-center">🗑</span>Delete
      </button>
      <div className="mt-2 flex gap-1">
        <button disabled={!canUndo} onClick={() => s.undo()} className="flex-1 rounded border border-stone-300 px-2 py-1 text-sm disabled:opacity-40" title="Ctrl+Z">Undo</button>
        <button disabled={!canRedo} onClick={() => s.redo()} className="flex-1 rounded border border-stone-300 px-2 py-1 text-sm disabled:opacity-40" title="Ctrl+Y">Redo</button>
      </div>
    </nav>
  )
}
