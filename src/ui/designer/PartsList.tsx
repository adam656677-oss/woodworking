import { useMemo, useState } from 'react'
import { renameBoard } from '../../model/ops'
import type { Board, Group, Project } from '../../model/types'
import { ancestry, renameGroup } from '../../assemblies/ops'
import { formatInches } from '../../model/units'
import { studio, useStudio } from '../store'
import { SizesTab } from '../../formulas/ui/SizesTab'

/** The left panel: Parts and (in the Master Shop) Sizes. */
export function PartsList() {
  const kids = useStudio(s => s.kidsMode)
  const [tab, setTab] = useState<'parts' | 'sizes'>('parts')
  if (kids) return <PartsTab />
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div role="tablist" className="flex border-b border-stone-200 bg-stone-50 text-xs font-bold uppercase">
        {(['parts', 'sizes'] as const).map(t => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`flex-1 px-3 py-1.5 ${tab === t ? 'border-b-2 border-amber-700 text-stone-800' : 'text-stone-500'}`}>{t === 'parts' ? 'Parts' : 'Sizes'}</button>
        ))}
      </div>
      {tab === 'parts' ? <PartsTab /> : <SizesTab />}
    </div>
  )
}

type Row = { kind: 'board'; board: Board } | { kind: 'group'; group: Group; rows: Row[] }

/** Parts in board order; a group shows where its first part would be, with its parts and sub-groups inside. */
function treeOf(p: Project, flat: boolean): Row[] {
  if (flat || !p.groups?.length) return p.boards.map(board => ({ kind: 'board', board }))
  const build = (parentId: string | undefined): Row[] => {
    const out: Row[] = []
    const placed = new Set<string>()
    for (const b of p.boards) {
      const chain = ancestry(p, b.groupId)
      // The group of this part that sits directly under `parentId`.
      const idx = parentId ? chain.findIndex(g => g.id === parentId) : chain.length
      if (idx < 0) continue
      if (idx === 0) { out.push({ kind: 'board', board: b }); continue }
      const g = chain[idx - 1]
      if (placed.has(g.id)) continue
      placed.add(g.id)
      out.push({ kind: 'group', group: g, rows: build(g.id) })
    }
    return out
  }
  return build(undefined)
}
const boardsIn = (rows: Row[]): Board[] => rows.flatMap(r => (r.kind === 'board' ? [r.board] : boardsIn(r.rows)))

function PartsTab() {
  const project = useStudio(s => s.project)
  const boards = project.boards
  const kids = useStudio(s => s.kidsMode)
  const selection = useStudio(s => s.selection)
  const warnings = useStudio(s => s.warnings)
  const hidden = useStudio(s => s.hidden)
  const isolated = useStudio(s => s.isolated)
  const warned = useMemo(() => new Set(warnings.flatMap(w => w.boardIds)), [warnings])
  const [editing, setEditing] = useState<string | null>(null)
  const [anchor, setAnchor] = useState<string | null>(null)
  const [closed, setClosed] = useState<Set<string>>(new Set())
  const rows = useMemo(() => treeOf(project, kids), [project, kids])
  const order = useMemo(() => boardsIn(rows).map(b => b.id), [rows])
  const isHidden = (id: string) => hidden.includes(id) || (!!isolated && !isolated.includes(id))

  const click = (id: string, e: React.MouseEvent) => {
    const s = studio.getState()
    if (e.shiftKey && anchor) {
      const [a, b] = [order.indexOf(anchor), order.indexOf(id)].sort((x, y) => x - y)
      s.select(order.slice(a, b + 1))
    } else if (e.ctrlKey || e.metaKey) {
      s.select(selection.includes(id) ? selection.filter(x => x !== id) : [...selection, id])
      setAnchor(id)
    } else {
      s.select([id])
      setAnchor(id)
    }
  }
  const eye = (ids: string[], label: string) => {
    const off = ids.every(isHidden)
    return (
      <button aria-label={`${off ? 'Show' : 'Hide'} ${label}`} title={off ? 'Show' : 'Hide'} onClick={e => { e.stopPropagation(); studio.getState().setHidden(ids, !off) }}
        className={`shrink-0 px-1 text-xs ${off ? 'text-stone-300' : 'text-stone-500 hover:text-stone-800'}`}>{off ? '◌' : '👁'}</button>
    )
  }

  const boardRow = (b: Board, depth: number) => (
    <li
      key={b.id}
      aria-selected={selection.includes(b.id)}
      onClick={e => click(b.id, e)}
      onDoubleClick={() => setEditing(b.id)}
      style={{ paddingLeft: 12 + depth * 14 }}
      className={`cursor-pointer border-b border-stone-100 py-1.5 pr-3 text-sm ${selection.includes(b.id) ? 'bg-amber-200' : 'hover:bg-stone-100'} ${isHidden(b.id) ? 'text-stone-400' : ''}`}
    >
      {editing === b.id ? (
        <input
          autoFocus
          aria-label="Part name"
          defaultValue={b.name}
          className="w-full rounded border px-1"
          onBlur={e => {
            const v = e.target.value.trim()
            if (v && v !== b.name) studio.getState().apply(p => renameBoard(p, b.id, v))
            setEditing(null)
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            if (e.key === 'Escape') setEditing(null)
          }}
        />
      ) : (
        <div className="flex justify-between gap-2">
          <span className="truncate">{warned.has(b.id) && <span className="text-red-600" title="Has a warning">⚠ </span>}{b.name}{b.link && <span title="Linked copy" className="text-amber-700"> 🔗</span>}</span>
          <span className="flex shrink-0 items-center gap-1 text-xs text-stone-500">{formatInches(b.width)} × {formatInches(b.length)}{!kids && eye([b.id], b.name)}</span>
        </div>
      )}
    </li>
  )
  const groupRow = (g: Group, inner: Row[], depth: number): React.ReactNode => {
    const ids = boardsIn(inner).map(b => b.id)
    const all = ids.length > 0 && ids.every(id => selection.includes(id))
    const open = !closed.has(g.id)
    return (
      <li key={g.id} className="border-b border-stone-100">
        <div
          role="button"
          aria-label={`Group ${g.name}`}
          aria-pressed={all}
          onClick={() => studio.getState().select(ids)}
          onDoubleClick={() => setEditing(g.id)}
          style={{ paddingLeft: 4 + depth * 14 }}
          className={`flex cursor-pointer items-center gap-1 py-1.5 pr-3 text-sm font-semibold ${all ? 'bg-amber-200' : 'bg-stone-50 hover:bg-stone-100'}`}
        >
          <span role="button" aria-label={open ? `Close ${g.name}` : `Open ${g.name}`} onClick={e => { e.stopPropagation(); setClosed(c => { const n = new Set(c); if (open) n.add(g.id); else n.delete(g.id); return n }) }} className="w-4 text-xs text-stone-500">{open ? '▾' : '▸'}</span>
          {editing === g.id ? (
            <input autoFocus aria-label="Group name" defaultValue={g.name} className="min-w-0 flex-1 rounded border px-1 font-normal"
              onClick={e => e.stopPropagation()}
              onBlur={e => { const v = e.target.value.trim(); if (v && v !== g.name) studio.getState().apply(p => renameGroup(p, g.id, v)); setEditing(null) }}
              onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditing(null) }} />
          ) : (
            <span className="min-w-0 flex-1 truncate">{g.name}{g.link && <span title="Linked copy" className="text-amber-700"> 🔗</span>}</span>
          )}
          <span className="text-xs font-normal text-stone-500">{ids.length}</span>
          {eye(ids, g.name)}
        </div>
        {open && <ul aria-label={`Parts in ${g.name}`}>{render(inner, depth + 1)}</ul>}
      </li>
    )
  }
  const render = (list: Row[], depth: number): React.ReactNode[] => list.map(r => (r.kind === 'board' ? boardRow(r.board, depth) : groupRow(r.group, r.rows, depth)))

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <h2 className="sticky top-0 z-10 bg-stone-50 px-3 py-2 text-xs font-bold uppercase tracking-wide text-stone-500">Parts ({boards.length})</h2>
      <ul aria-label="Parts">{render(rows, 0)}</ul>
    </div>
  )
}
