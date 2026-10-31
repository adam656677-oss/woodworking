import { contactBetween, jointOffers } from '../../model/contact'
import { addJoint, removeJoint, updateJoint } from '../../model/ops'
import type { ButtParams, GrooveParams, Joint, JointType, JoineryParams, JoineryStyle, MiterParams, PocketParams } from '../../model/types'
import { STYLE_NAMES } from '../../joinery/cuts'
import { joineryOffers } from '../../joinery/plan'
import { studio, useStudio } from '../store'
import { NumberInput } from '../common/NumberInput'
import { InchInput } from './InchInput'
import { FormulaInput, type FormulaSet } from '../../formulas/ui/FormulaInput'
import { setGrooveValue, setJointFormula } from '../../formulas/ops'

const NAMES: Record<JointType, string> = { butt: 'Butt', dado: 'Dado', rabbet: 'Rabbet', pocketScrew: 'Pocket screws', miter: 'Miter', joinery: 'Cut joint' }

/** Which settings each joinery style shows. */
const FIELDS: Partial<Record<JoineryStyle, ('depth' | 'size' | 'count' | 'shoulder' | 'slope' | 'lap' | 'through' | 'biscuit' | 'haunch')[]>> = {
  mortiseTenon: ['size', 'depth', 'shoulder', 'through', 'haunch'], hozoSashi: ['size', 'depth'], shachiSen: ['size'], boxJoint: ['size', 'count'],
  dovetail: ['count', 'size', 'slope'], halfBlindDovetail: ['count', 'size', 'slope', 'lap'], tongueGroove: ['size', 'depth'], spline: ['size', 'depth'],
  dowel: ['size', 'count', 'depth'], biscuit: ['biscuit', 'count'], looseTenon: ['size', 'count', 'depth'], koshikakeAri: ['depth'], kama: ['depth'], okkakeDaisen: ['depth'], kanawa: ['depth']
}
const LABELS = { depth: 'Length / depth', size: 'Thickness / size', count: 'How many', shoulder: 'Shoulders', slope: 'Slope 1:', lap: 'Lap', through: 'Through', biscuit: 'Biscuit', haunch: 'Haunch' }

function JoinerySettings({ joint }: { joint: Joint }) {
  const apply = studio.getState().apply
  const jp = joint.params as JoineryParams
  const set = (patch: Partial<JoineryParams>) => apply(p => updateJoint(p, joint.id, patch))
  const problem = useStudio(s => s.warnings.find(w => w.kind === 'badJoint' && w.boardIds.includes(joint.hostBoardId) && w.boardIds.includes(joint.partnerBoardId))?.message)
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-semibold">{STYLE_NAMES[jp.style]}</p>
      {(FIELDS[jp.style] ?? []).map(f => {
        if (f === 'through' || f === 'haunch') return <label key={f} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={!!jp[f]} onChange={e => set({ [f]: e.target.checked })} />{LABELS[f]}</label>
        if (f === 'biscuit') return <label key={f} className="flex items-center justify-between text-xs">Biscuit<select aria-label="Biscuit size" value={jp.biscuit ?? '20'} onChange={e => set({ biscuit: e.target.value as JoineryParams['biscuit'] })} className="rounded border px-1 text-sm"><option value="0">#0</option><option value="10">#10</option><option value="20">#20</option></select></label>
        if (f === 'count') return <NumberField key={f} label={LABELS[f]} value={jp.count ?? 1} min={1} max={40} onChange={v => set({ count: v })} />
        if (f === 'slope') return <NumberField key={f} label={LABELS[f]} value={jp.slope ?? 8} min={4} max={12} onChange={v => set({ slope: v })} />
        return <InchInput key={f} label={LABELS[f]} allowZero={f === 'shoulder'} value={jp[f] ?? 0} onChange={v => set({ [f]: v })} />
      })}
      {problem && <p role="alert" className="text-xs text-red-700">{problem}</p>}
    </div>
  )
}

function NumberField({ label, value, onChange, min = 0, max }: { label: string; value: number; onChange(v: number): void; min?: number; max?: number }) {
  return <NumberInput label={label} value={value} onChange={onChange} min={min} max={max} />
}

function GrooveBox({ joint, field, label, value }: { joint: Joint; field: 'width' | 'depth' | 'offset'; label: string; value: number }) {
  const errors = useStudio(s => s.formulaErrors)
  const kids = useStudio(s => s.kidsMode)
  const apply = studio.getState().apply
  if (kids) return <InchInput label={label} allowZero={field === 'offset'} value={value} onChange={v => apply(p => updateJoint(p, joint.id, { [field]: v }))} />
  const onSet = (s: FormulaSet) => apply(p => ('formula' in s ? setJointFormula(p, joint.id, field, s.formula) : setGrooveValue(p, joint.id, field, s.value)))
  return <FormulaInput label={label} allowZero={field === 'offset'} value={value} formula={joint.formulas?.[field]} error={errors[`joint:${joint.id}:${field}`]} onSet={onSet} />
}

function JointSettings({ joint }: { joint: Joint }) {
  if (joint.type === 'joinery') return <JoinerySettings joint={joint} />
  const apply = studio.getState().apply
  const set = (patch: Record<string, unknown>) => apply(p => updateJoint(p, joint.id, patch))
  if (joint.type === 'dado' || joint.type === 'rabbet') {
    const g = joint.params as GrooveParams
    return (
      <div className="grid grid-cols-2 gap-2">
        {(['width', 'depth', 'offset'] as const).map(k => (
          <GrooveBox key={`${joint.id}-${k}`} joint={joint} field={k} label={k === 'offset' ? 'Offset' : `${NAMES[joint.type]} ${k}`} value={g[k]} />
        ))}
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
  const kidsMode = useStudio(s => s.kidsMode)
  const nameOf = (id: string) => project.boards.find(x => x.id === id)?.name ?? '?'
  const existing = project.joints.find(j => (j.hostBoardId === a && j.partnerBoardId === b) || (j.hostBoardId === b && j.partnerBoardId === a))
  const apply = studio.getState().apply

  return (
    <section aria-label="Joint" className="flex flex-col gap-3">
      <h2 className="text-sm font-bold">{nameOf(a)} + {nameOf(b)}</h2>
      {existing ? (
        <>
          <p className="text-sm">Joined with {existing.type === 'joinery' ? <strong>{STYLE_NAMES[(existing.params as JoineryParams).style].toLowerCase()}</strong> : <>a <strong>{NAMES[existing.type].toLowerCase()}</strong></>} ({nameOf(existing.hostBoardId)} is the host).</p>
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
            {jointOffers(c).filter(t => !kidsMode || t === 'butt').map(t => (
              <button key={t} className="rounded bg-amber-100 py-1.5 text-sm font-semibold hover:bg-amber-200" onClick={() => apply(p => { const r = addJoint(p, t, c.host, c.partner); return 'error' in r ? r : r.project })}>
                {NAMES[t]}
              </button>
            ))}
            {!kidsMode && (
              <label className="flex flex-col gap-1 text-xs text-stone-600">Cut joints
                <select aria-label="Cut joint" value="" className="rounded border px-1 py-1 text-sm" onChange={e => {
                  const [style, customId] = e.target.value.split(':') as [JoineryStyle, string | undefined]
                  if (style) apply(p => { const r = addJoint(p, 'joinery', c.host, c.partner, { style, ...(customId ? { customId } : {}) }); return 'error' in r ? r : r.project })
                }}>
                  <option value="">Choose…</option>
                  {joineryOffers(c).flatMap(s => (s === 'custom' ? (project.customJoints ?? []).filter(cj => (cj.layout === 'cross') === (c.kind === 'faceToFace')).map(cj => <option key={cj.id} value={`custom:${cj.id}`}>{cj.name} (designed)</option>) : [<option key={s} value={s}>{STYLE_NAMES[s]}</option>]))}
                </select>
              </label>
            )}
          </div>
        )
      })()}
    </section>
  )
}
