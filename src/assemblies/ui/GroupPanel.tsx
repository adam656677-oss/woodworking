// The properties of a whole group (assembly): name, place, size, copies and links.
import { useEffect, useState } from 'react'
import type { Group } from '../../model/types'
import { formatInches } from '../../model/units'
import { InchInput } from '../../ui/designer/InchInput'
import { studio, useStudio } from '../../ui/store'
import { copyGroup, groupBoardIds, groupBox, moveGroup, renameGroup, ungroup, unlinkGroup } from '../ops'

export function GroupPanel({ group }: { group: Group }) {
  const project = useStudio(s => s.project)
  const [name, setName] = useState(group.name)
  useEffect(() => setName(group.name), [group.name])
  const box = groupBox(project, group.id)
  const apply = studio.getState().apply
  if (!box) return null
  const count = groupBoardIds(project, group.id).length
  const linked = group.link ? (project.groups ?? []).filter(g => g.link === group.link).length : 0
  const copy = (link: boolean) => {
    let id = ''
    apply(p => { const r = copyGroup(p, group.id, link); if ('error' in r) return r; id = r.id; return r.project })
    if (id) studio.getState().select(groupBoardIds(studio.getState().project, id))
  }
  return (
    <section aria-label="Group" className="mb-3 flex flex-col gap-2 rounded border border-amber-300 bg-amber-50 p-2">
      <label className="flex flex-col text-xs text-stone-600">Group
        <input aria-label="Group name" value={name} onChange={e => setName(e.target.value)}
          onBlur={() => { if (name.trim() && name.trim() !== group.name) apply(p => renameGroup(p, group.id, name)); else setName(group.name) }}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
          className="rounded border border-stone-300 px-2 py-1 text-sm font-semibold text-stone-800" />
      </label>
      <p className="text-xs text-stone-600">
        {count} parts · {formatInches(box.max.x - box.min.x)} wide × {formatInches(box.max.y - box.min.y)} deep × {formatInches(box.max.z - box.min.z)} high
        {linked > 1 && <><br /><span className="font-semibold text-amber-800">🔗 Linked — {linked} copies stay the same</span></>}
      </p>
      <div className="grid grid-cols-3 gap-2">
        {(['x', 'y', 'z'] as const).map(a => (
          <InchInput key={a} label={`Group ${a.toUpperCase()}`} allowZero value={box.min[a]} onChange={v => apply(p => moveGroup(p, group.id, a, v))} />
        ))}
      </div>
      <div className="flex flex-wrap gap-1">
        <button className="rounded bg-stone-200 px-2 py-0.5 text-xs hover:bg-stone-300" onClick={() => copy(false)}>Duplicate group</button>
        <button className="rounded bg-amber-700 px-2 py-0.5 text-xs font-semibold text-white" onClick={() => copy(true)} title="A copy that stays the same as this one">Linked copy</button>
        {linked > 1 && <button className="rounded bg-stone-200 px-2 py-0.5 text-xs hover:bg-stone-300" onClick={() => apply(p => unlinkGroup(p, group.id))}>Unlink</button>}
        <button className="rounded bg-stone-200 px-2 py-0.5 text-xs hover:bg-stone-300" onClick={() => apply(p => ungroup(p, group.id))}>Ungroup</button>
      </div>
    </section>
  )
}

/** Asks for a new group's name. */
export function GroupNameDialog({ onDone }: { onDone(name: string | null): void }) {
  const [name, setName] = useState('Assembly')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/20">
      <form role="dialog" aria-label="Name the group" className="flex w-80 flex-col gap-3 rounded-lg bg-white p-4 shadow-xl"
        onSubmit={e => { e.preventDefault(); onDone(name.trim() || null) }}>
        <label className="flex flex-col text-sm">Group name
          <input autoFocus aria-label="Group name" value={name} onChange={e => setName(e.target.value)} onFocus={e => e.target.select()} className="rounded border border-stone-300 px-2 py-1" />
        </label>
        <p className="text-xs text-stone-500">For example Drawer, Door, Carcass or Base.</p>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => onDone(null)} className="rounded px-3 py-1 text-sm hover:bg-stone-100">Cancel</button>
          <button type="submit" className="rounded bg-amber-700 px-3 py-1 text-sm font-semibold text-white">Group</button>
        </div>
      </form>
    </div>
  )
}
