import { useEffect, useMemo, useState } from 'react'
import { ToolbarMenu as Menu } from '../common/ToolbarMenu'
import { studio, useStudio } from '../store'
import { wholeGroup } from '../../assemblies/ops'
import { GroupNameDialog } from '../../assemblies/ui/GroupPanel'
import { ShareDialog } from '../../family/ui/ShareDialog'
import { KidsLookButton } from '../../render/ui/RenderControls'
import { buildCommands, commandHint, KIDS_TOOLBAR, makeGroup, TOOLBAR_LAYOUT, type DialogRequest, type StudioCommand, type ToolbarEntry } from '../commands'

function Btn(props: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  const { active, className, ...rest } = props
  return (
    <button
      {...rest}
      aria-pressed={active === undefined ? undefined : active}
      className={`rounded px-2 py-1 text-sm disabled:opacity-40 ${active ? 'bg-amber-700 text-white' : 'hover:bg-stone-200'} ${className ?? ''}`}
    />
  )
}

const item = 'px-3 py-1 text-left text-sm hover:bg-amber-100'

/**
 * The Master Shop toolbar. Every button and menu item comes from the shared command list, grouped as
 * File, Create, Modify, Joinery, Inspect and Output, so the palette (Ctrl+K) offers exactly the same things.
 */
export function Toolbar() {
  const kidsMode = useStudio(s => s.kidsMode)
  const view = useStudio(s => s.view)
  const measuring = useStudio(s => s.measuring)
  const isolated = useStudio(s => s.isolated)
  const selection = useStudio(s => s.selection)
  const project = useStudio(s => s.project)
  const canUndo = useStudio(s => s.canUndo)
  const canRedo = useStudio(s => s.canRedo)
  const hidden = useStudio(s => s.hidden)
  const [naming, setNaming] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [shared, setShared] = useState<string | null>(null)
  // Commands read the live store; the subscriptions above re-render this when anything they depend on changes.
  const commands = useMemo(() => buildCommands(), [kidsMode, view, measuring, isolated, selection, project, canUndo, canRedo, hidden])
  const byId = useMemo(() => new Map(commands.map(c => [c.id, c])), [commands])
  const sections = kidsMode ? KIDS_TOOLBAR : TOOLBAR_LAYOUT
  const whole = useMemo(() => (kidsMode ? null : wholeGroup(project, selection)), [kidsMode, project, selection])

  useEffect(() => {
    const onAsk = (e: Event) => {
      const d = (e as CustomEvent<DialogRequest>).detail
      if (d.kind === 'group') { if (!kidsMode && studio.getState().selection.length > 1) setNaming(true) }
      else if (d.kind === 'share') setSharing(true)
      else setShared(d.message)
    }
    window.addEventListener('aa:toolbar-dialog', onAsk)
    return () => window.removeEventListener('aa:toolbar-dialog', onAsk)
  }, [kidsMode])

  const expand = (id: string): StudioCommand[] => (id.endsWith('*') ? commands.filter(c => c.id.startsWith(id.slice(0, -1))) : byId.has(id) ? [byId.get(id)!] : [])
  const name = (c: StudioCommand) => c.short ?? c.label
  const activeOf = (c: StudioCommand): boolean | undefined =>
    c.id === 'measure' ? measuring : c.id.startsWith('view-') ? view === c.id.slice(5) : c.id === 'isolate' ? !!isolated : undefined

  const entry = (e: ToolbarEntry) => {
    if ('menu' in e) {
      const items = e.items.flatMap(expand)
      return (
        <Menu key={e.menu} label={e.menu} title={e.title}>
          {close => items.map((c, i) => (
            <div key={c.id} role="none" className="flex flex-col">
              {c.id.startsWith('draw-open:') && !items[i - 1]?.id.startsWith('draw-open:') && <div className="border-t border-stone-200 px-3 pt-1 text-xs text-stone-500">Drawings</div>}
              <button role="menuitem" className={item} title={commandHint(c)} disabled={c.disabled} onClick={() => { close(); void c.run() }}>{name(c)}</button>
            </div>
          ))}
        </Menu>
      )
    }
    const c = byId.get(e.id)
    if (!c) return null
    return (
      <Btn key={c.id} title={commandHint(c)} disabled={c.disabled} active={activeOf(c)}
        className={`${e.accent ? 'bg-amber-100 font-semibold' : ''} ${e.strong ? 'font-semibold' : ''}`}
        onClick={() => { void c.run() }}>{e.name ?? name(c)}</Btn>
    )
  }

  return (
    <nav aria-label="Toolbar" className="flex flex-wrap items-stretch gap-x-1 gap-y-1 border-b border-stone-300 bg-white px-2 py-1">
      {kidsMode && (
        <div className="flex items-center gap-1 pr-1">
          <Btn onClick={() => studio.getState().goto('kids')} title="Back to the Kids' Workshop">⌂ Kids&apos; Workshop</Btn>
          <span className="px-2 text-sm font-bold text-violet-700">Simple Designer</span>
        </div>
      )}
      {sections.map((sec, i) => (
        <div key={sec.group} role="group" aria-label={sec.group} className={`flex flex-col justify-between ${i > 0 || kidsMode ? 'border-l border-stone-200 pl-1' : ''}`}>
          <div className="flex flex-wrap items-center gap-1">
            {sec.entries.map(entry)}
            {kidsMode && sec.group === 'Inspect' && <KidsLookButton />}
          </div>
          <span aria-hidden className="select-none pt-0.5 text-center text-[10px] uppercase tracking-wide text-stone-400">{sec.group}</span>
        </div>
      ))}
      {/* Room for the Help button (F1) at the right-hand end. */}
      <div className="ml-auto flex items-center gap-1" data-toolbar-slot="help" />
      {sharing && <ShareDialog onClose={() => setSharing(false)} />}
      {shared && <span role="status" className="self-center rounded bg-green-100 px-2 text-xs text-green-900">{shared}<button aria-label="Dismiss" className="ml-1" onClick={() => setShared(null)}>✕</button></span>}
      {naming && !whole && <GroupNameDialog onDone={n => { setNaming(false); makeGroup(n) }} />}
    </nav>
  )
}
