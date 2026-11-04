import { useEffect, useId, useRef, useState } from 'react'
import { studio, useStudio } from '../store'

export type StudioCommand = { id: string; label: string; keywords: string; disabled?: boolean; run(): void | Promise<unknown> }
export function filterCommands(commands: StudioCommand[], query: string): StudioCommand[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  return commands.filter(command => terms.every(term => `${command.label} ${command.keywords}`.toLowerCase().includes(term)))
}

export function CommandPalette() {
  const canUndo = useStudio(s => s.canUndo)
  const canRedo = useStudio(s => s.canRedo)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const dialog = useRef<HTMLDialogElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const id = useId()
  const show = () => {
    if (document.querySelector('dialog[open], [role="dialog"], [aria-modal="true"]')) return
    setQuery('')
    setIndex(0)
    setOpen(true)
  }
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && !event.altKey) {
        event.preventDefault()
        show()
      }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [])
  useEffect(() => {
    const el = dialog.current
    if (!el) return
    if (open && !el.open) { el.showModal(); input.current?.focus() }
    if (!open && el.open) el.close()
  }, [open])

  const state = () => studio.getState()
  const commands: StudioCommand[] = [
    { id: 'save', label: 'Save project', keywords: 'file write ctrl s', run: () => state().save() },
    { id: 'save-as', label: 'Save project as', keywords: 'file copy', run: () => state().saveAs() },
    { id: 'open', label: 'Open project', keywords: 'file load', run: () => state().open() },
    { id: 'undo', label: 'Undo', keywords: 'edit back', disabled: !canUndo, run: () => state().undo() },
    { id: 'redo', label: 'Redo', keywords: 'edit forward', disabled: !canRedo, run: () => state().redo() },
    { id: 'fit', label: 'Fit model to view', keywords: 'zoom camera extent', run: () => { window.dispatchEvent(new Event('aa:zoom-fit')) } },
    ...(['3d', 'front', 'side', 'top'] as const).map(view => ({ id: `view-${view}`, label: `${view === '3d' ? '3D' : view[0].toUpperCase() + view.slice(1)} view`, keywords: 'camera orientation', run: () => state().set({ view }) })),
    { id: 'measure', label: 'Toggle measurement tool', keywords: 'distance ruler dimensions', run: () => state().set({ measuring: !state().measuring }) },
    { id: 'drawings', label: 'Open drawings', keywords: 'print sheets plans', run: () => state().set({ drawingsOpen: true }) },
    { id: 'cut-list', label: 'Open cut list', keywords: 'stock materials shopping', run: () => state().set({ cutListOpen: true }) },
    { id: 'woods', label: 'Open wood library', keywords: 'species material lumber', run: () => state().set({ woodsOpen: true }) },
    { id: 'pictures', label: 'Open reference pictures', keywords: 'photo trace scale', run: () => state().setView({ picturesOpen: true }) },
    { id: 'interference', label: 'Inspect interference', keywords: 'checks collision overlap', run: () => state().setView({ checksOpen: 'interference' }) },
    { id: 'clearance', label: 'Inspect door and drawer clearance', keywords: 'checks motion collision cabinet', run: () => state().setView({ checksOpen: 'clearance' }) },
    { id: 'weight', label: 'Inspect weight and balance', keywords: 'checks mass centre', run: () => state().setView({ checksOpen: 'weight' }) },
    { id: 'notes', label: 'Open dimensions and notes', keywords: 'annotation checks', run: () => state().setView({ checksOpen: 'notes' }) }
  ]
  const results = filterCommands(commands, query)
  const selected = Math.min(index, Math.max(0, results.length - 1))
  const execute = (command: StudioCommand | undefined) => {
    if (!command || command.disabled) return
    dialog.current?.close()
    setOpen(false)
    void Promise.resolve().then(() => command.run()).catch(() => state().setError('The command could not finish. Your current project has not been replaced by the command palette.'))
  }

  return <>
    <button type="button" onClick={show} aria-keyshortcuts="Control+k Meta+k"
      className="fixed bottom-3 right-3 z-20 rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-700 shadow hover:bg-stone-100">Commands · Ctrl/Cmd+K</button>
    <dialog ref={dialog} aria-labelledby={`${id}-title`} onCancel={() => setOpen(false)} onClose={() => setOpen(false)}
      className="w-full max-w-xl rounded-xl border border-stone-300 bg-white p-0 text-stone-900 shadow-2xl backdrop:bg-stone-900/40"
      onKeyDown={event => {
        event.stopPropagation()
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault()
          setIndex(results.length ? (selected + (event.key === 'ArrowDown' ? 1 : results.length - 1)) % results.length : 0)
        } else if (event.key === 'Enter') { event.preventDefault(); execute(results[selected]) }
      }}>
      <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
        <h2 id={`${id}-title`} className="font-semibold">Find a command</h2>
        <button type="button" aria-label="Close commands" onClick={() => setOpen(false)} className="rounded px-2 py-1 hover:bg-stone-100">Esc</button>
      </div>
      <input ref={input} aria-label="Search commands" role="combobox" aria-autocomplete="list" aria-expanded={open}
        aria-controls={`${id}-results`} aria-activedescendant={results.length ? `${id}-${results[selected].id}` : undefined}
        value={query} onChange={event => { setQuery(event.target.value); setIndex(0) }}
        placeholder="Search views, dimensions, materials, drawings…" className="w-full border-b border-stone-200 px-4 py-3 outline-none focus:ring-2 focus:ring-inset focus:ring-blue-600" />
      <ul id={`${id}-results`} role="listbox" aria-label="Commands" className="max-h-80 overflow-y-auto p-2">
        {results.map((command, row) => <li key={command.id} id={`${id}-${command.id}`} role="option"
          aria-selected={row === selected} aria-disabled={command.disabled || undefined}
          onMouseDown={event => event.preventDefault()} onClick={() => execute(command)}
          className={`cursor-pointer rounded px-3 py-2 text-sm ${row === selected ? 'bg-blue-50 text-blue-900' : 'hover:bg-stone-100'} ${command.disabled ? 'opacity-40' : ''}`}>{command.label}</li>)}
      </ul>
      {!results.length && <p role="status" className="px-4 py-6 text-sm text-stone-500">No matching commands.</p>}
      <p className="border-t border-stone-200 px-4 py-2 text-xs text-stone-500">↑ ↓ to navigate · Enter to run · Escape to close</p>
    </dialog>
  </>
}
