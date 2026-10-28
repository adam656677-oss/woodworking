import { contactBetween, jointOffers } from '../../model/contact'
import { addJoint, removeJoint, updateJoint } from '../../model/ops'
import type { ButtParams, GrooveParams, Joint, JointType, MiterParams, PocketParams } from '../../model/types'
import { studio, useStudio } from '../store'
import { NumberInput } from '../common/NumberInput'
import { InchInput } from './InchInput'

const NAMES: Record<JointType, string> = { butt: 'Butt', dado: 'Dado', rabbet: 'Rabbet', pocketScrew: 'Pocket screws', miter: 'Miter' }

function NumberField({ label, value, onChange, min = 0, max }: { label: string; value: number; onChange(v: number): void; min?: number; max?: number }) {
  return <NumberInput label={label} value={value} onChange={onChange} min={min} max={max} />
}

function JointSettings({ joint }: { joint: Joint }) {
  const apply = studio.getState().apply
  const set = (patch: Record<string, unknown>) => apply(p => updateJoint(p, joint.id, patch))
  if (joint.type === 'dado' || joint.type === 'rabbet') {
    const g = joint.params as GrooveParams
    return (
      <div className="grid grid-cols-2 gap-2">
        <InchInput label={`${NAMES[joint.type]} width`} value={g.width} onChange={v => set({ width: v })} />
        <InchInput label={`${NAMES[joint.type]} depth`} value={g.depth} onChange={v => set({ depth: v })} />
        <InchInput label="Offset" allowZero value={g.offset} onChange={v => set({ offset: v })} />
      </div>
    )
  }
  if (joint.type === 'butt') {
    const b = joint.params as ButtParams
    return (
      <div className="flex flex-col gap-2">
        <label className="flex items-center justify-between text-xs text-stone-600">
          Fastener
          <select aria-label="Fastener" value={b.fastener} onChange={e => set({ fastener: e.target.value, count: e.target.value === 'glue' ? 0 : Math.max(1, b.count) })} className="rounded border px-1 text-sm">
            <option value="glue">Glue</option><option value="screws">Screws</option><option value="nails">Nails</option>
          </select>
        </label>
        {b.fastener !== 'glue' && <NumberField label="How many" value={b.count} min={1} onChange={v => set({ count: v })} />}
      </div>
    )
  }
  if (joint.type === 'pocketScrew') {
    const k = joint.params as PocketParams
    return (
      <div className="flex flex-col gap-2">
        <NumberField label="Screws" value={k.count} min={1} onChange={v => set({ count: v })} />
        <InchInput label="Spacing" value={k.spacing} onChange={v => set({ spacing: v })} />
        <InchInput label="Screw length" value={k.screwLength} onChange={v => set({ screwLength: v })} />
      </div>
    )
  }
  const m = joint.params as MiterParams
  return (
    <div className="flex flex-col gap-2">
      <NumberField label="Angle°" value={m.angle} min={1} max={60} onChange={v => set({ angle: v })} />
      <label className="flex items-center justify-between text-xs text-stone-600">
        Fastener
        <select aria-label="Miter fastener" value={m.fastener} onChange={e => set({ fastener: e.target.value })} className="rounded border px-1 text-sm">
          <option value="glue">Glue</option><option value="nails">Nails</option><option value="splines">Splines</option>
        </select>
      </label>
    </div>
  )
}

/** Shown when exactly two parts are selected: the joint between them, or the joints that fit. */
export function JointPanel() {
  const project = useStudio(s => s.project)
  const [a, b] = useStudio(s => s.selection)
  const nameOf = (id: string) => project.boards.find(x => x.id === id)?.name ?? '?'
  const existing = project.joints.find(j => (j.hostBoardId === a && j.partnerBoardId === b) || (j.hostBoardId === b && j.partnerBoardId === a))
  const apply = studio.getState().apply

  return (
    <section aria-label="Joint" className="flex flex-col gap-3">
      <h2 className="text-sm font-bold">{nameOf(a)} + {nameOf(b)}</h2>
      {existing ? (
        <>
          <p className="text-sm">Joined with a <strong>{NAMES[existing.type].toLowerCase()}</strong> ({nameOf(existing.hostBoardId)} is the host).</p>
          <JointSettings joint={existing} />
          <button className="rounded border border-red-600 py-1 text-sm text-red-700 hover:bg-red-50" onClick={() => apply(p => removeJoint(p, existing.id))}>
            Remove joint
          </button>
        </>
      ) : (() => {
        const c = contactBetween(project, a, b)
        if (!c) return <p className="text-sm text-stone-600">These parts don&apos;t touch. Move them together (snapping helps) to join them.</p>
        return (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-stone-600">Choose a joint:</p>
            {jointOffers(c).map(t => (
              <button key={t} className="rounded bg-amber-100 py-1.5 text-sm font-semibold hover:bg-amber-200" onClick={() => apply(p => { const r = addJoint(p, t, c.host, c.partner); return 'error' in r ? r : r.project })}>
                {NAMES[t]}
              </button>
            ))}
          </div>
        )
      })()}
    </section>
  )
}
