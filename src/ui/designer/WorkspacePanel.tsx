import { useId, useState, type ReactNode } from 'react'

export const MIN_PANEL_WIDTH = 200
export const MAX_PANEL_WIDTH = 420
export function clampPanelWidth(value: number) {
  return Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, value))
}

type Props = { title: string; side: 'left' | 'right'; initialWidth: number; children: ReactNode }

export function WorkspacePanel({ title, side, initialWidth, children }: Props) {
  const [width, setWidth] = useState(() => clampPanelWidth(initialWidth))
  const [collapsed, setCollapsed] = useState(false)
  const id = useId()
  const direction = side === 'left' ? 1 : -1
  const [drag, setDrag] = useState<{ x: number; width: number } | null>(null)

  return <aside aria-label={title} className="relative flex shrink-0 flex-col border-x border-stone-200 bg-white" style={{ width: collapsed ? 44 : width }}>
    <header className="flex min-h-11 shrink-0 items-center justify-between gap-2 border-b border-stone-200 px-2">
      {!collapsed && <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-600">{title}</h2>}
      <button type="button" aria-expanded={!collapsed} aria-controls={id} aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${title}`}
        title={`${collapsed ? 'Expand' : 'Collapse'} ${title}`} className="rounded px-2 py-1 text-stone-600 hover:bg-stone-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
        onClick={() => setCollapsed(v => !v)}>{collapsed ? '+' : '−'}</button>
    </header>
    <div id={id} hidden={collapsed} className="min-h-0 flex-1 overflow-auto">{children}</div>
    {!collapsed && <div role="separator" aria-label={`Resize ${title}`} aria-orientation="vertical" aria-controls={id}
      aria-valuemin={MIN_PANEL_WIDTH} aria-valuemax={MAX_PANEL_WIDTH} aria-valuenow={width} aria-valuetext={`${Math.round(width)} pixels`} tabIndex={0}
      title="Drag to resize; use arrow keys when focused; double-click to reset"
      className={`absolute inset-y-0 z-10 w-1.5 cursor-col-resize touch-none hover:bg-blue-400 focus-visible:bg-blue-500 focus-visible:outline-none ${side === 'left' ? '-right-1' : '-left-1'}`}
      onDoubleClick={() => setWidth(clampPanelWidth(initialWidth))}
      onKeyDown={e => {
        if (e.key === 'Home' || e.key === 'End') {
          e.preventDefault()
          setWidth(e.key === 'Home' ? MIN_PANEL_WIDTH : MAX_PANEL_WIDTH)
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault()
          const delta = (e.key === 'ArrowRight' ? 1 : -1) * direction * (e.shiftKey ? 40 : 10)
          setWidth(w => clampPanelWidth(w + delta))
        }
      }}
      onPointerDown={e => {
        if (e.button !== 0) return
        e.preventDefault()
        e.currentTarget.focus()
        e.currentTarget.setPointerCapture(e.pointerId)
        setDrag({ x: e.clientX, width })
      }}
      onPointerMove={e => { if (drag) setWidth(clampPanelWidth(drag.width + (e.clientX - drag.x) * direction)) }}
      onPointerUp={e => {
        setDrag(null)
        if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
      }}
      onPointerCancel={() => setDrag(null)} onLostPointerCapture={() => setDrag(null)}
    />}
  </aside>
}
