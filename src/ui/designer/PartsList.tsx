import { useMemo, useState } from 'react'
import { renameBoard } from '../../model/ops'
import { formatInches } from '../../model/units'
import { studio, useStudio } from '../store'

export function PartsList() {
  const boards = useStudio(s => s.project.boards)
  const selection = useStudio(s => s.selection)
  const warnings = useStudio(s => s.warnings)
  const warned = useMemo(() => new Set(warnings.flatMap(w => w.boardIds)), [warnings])
  const [editing, setEditing] = useState<string | null>(null)
  const [anchor, setAnchor] = useState<string | null>(null)

  const click = (id: string, e: React.MouseEvent) => {
    const s = studio.getState()
    if (e.shiftKey && anchor) {
      const ids = boards.map(b => b.id)
      const [a, b] = [ids.indexOf(anchor), ids.indexOf(id)].sort((x, y) => x - y)
      s.select(ids.slice(a, b + 1))
    } else if (e.ctrlKey || e.metaKey) {
      s.select(selection.includes(id) ? selection.filter(x => x !== id) : [...selection, id])
      setAnchor(id)
    } else {
      s.select([id])
      setAnchor(id)
    }
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <h2 className="sticky top-0 bg-stone-50 px-3 py-2 text-xs font-bold uppercase tracking-wide text-stone-500">Parts ({boards.length})</h2>
      <ul aria-label="Parts">
        {boards.map(b => (
          <li
            key={b.id}
            aria-selected={selection.includes(b.id)}
            onClick={e => click(b.id, e)}
            onDoubleClick={() => setEditing(b.id)}
            className={`cursor-pointer border-b border-stone-100 px-3 py-1.5 text-sm ${selection.includes(b.id) ? 'bg-amber-200' : 'hover:bg-stone-100'}`}
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
                <span className="truncate">{warned.has(b.id) && <span className="text-red-600" title="Has a warning">⚠ </span>}{b.name}</span>
                <span className="shrink-0 text-xs text-stone-500">{formatInches(b.width)} × {formatInches(b.length)}</span>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
