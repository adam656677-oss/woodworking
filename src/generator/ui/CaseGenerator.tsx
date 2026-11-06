// "New case…": set the sizes and construction, see the parts, cut list and clearances, then add it to the design.
import { useMemo, useState, type ReactNode } from 'react'
import { worldBox } from '../../model/geometry'
import { cutList } from '../../model/cutlist'
import type { Project } from '../../model/types'
import { formatInches } from '../../model/units'
import { InchInput } from '../../ui/designer/InchInput'
import { studio, useStudio } from '../../ui/store'
import { addCase, CASE_DEFAULTS, CONSTRUCTION_LABELS, KIND_LABELS, LIMITS, previewCase, type CaseKind, type CaseSpec, type Construction } from '../caseGenerator'

/** The case seen from the front: every part as its outline, back panel behind. */
function FrontView({ project }: { project: Project }) {
  const boxes = project.boards.map(b => ({ b, w: worldBox(b) }))
  const minX = Math.min(...boxes.map(x => x.w.min.x)), maxX = Math.max(...boxes.map(x => x.w.max.x))
  const maxZ = Math.max(...boxes.map(x => x.w.max.z))
  const W = maxX - minX, H = maxZ
  const pad = Math.max(W, H) * 0.12
  const order = [...boxes].sort((a, b) => b.w.max.y - a.w.max.y)
  return (
    <svg role="img" aria-label="Front view of the case" viewBox={`${minX - pad} ${-H - pad * 0.6} ${W + 2 * pad} ${H + 1.6 * pad}`} className="h-64 w-full rounded border border-stone-200 bg-stone-50">
      {order.map(({ b, w }) => (
        <rect key={b.id} x={w.min.x} y={-w.max.z} width={w.max.x - w.min.x} height={w.max.z - w.min.z}
          fill={b.name === 'Back' ? '#e7dcc8' : b.name === 'Shelf' ? '#d6b98a' : '#c99e63'} stroke="#6b4f2a" strokeWidth={Math.max(W, H) / 400} vectorEffect="non-scaling-stroke" />
      ))}
      <text x={minX + W / 2} y={pad * 0.75} textAnchor="middle" fontSize={pad * 0.45} fill="#44403c">{formatInches(W)} wide</text>
      <text x={maxX + pad * 0.2} y={-H / 2} fontSize={pad * 0.45} fill="#44403c">{formatInches(H)}</text>
    </svg>
  )
}

const field = 'rounded border border-stone-300 px-1 py-1 text-sm'
const Label = ({ text, children }: { text: string; children: ReactNode }) => <label className="flex flex-col gap-0.5 text-xs text-stone-600">{text}{children}</label>

export function CaseGenerator() {
  const project = useStudio(s => s.project)
  const [spec, setSpec] = useState<CaseSpec>(CASE_DEFAULTS.bookcase)
  const [error, setError] = useState<string | null>(null)
  const set = (patch: Partial<CaseSpec>) => { setError(null); setSpec(s => ({ ...s, ...patch })) }
  const preview = useMemo(() => previewCase(project, spec), [project.woods, spec]) // eslint-disable-line react-hooks/exhaustive-deps
  const rows = 'error' in preview ? [] : cutList(preview.project).rows
  const caseWoods = project.woods.filter(w => w.thickness >= 0.5)
  const backWoods = project.woods.filter(w => w.kind === 'sheet' && w.thickness <= 0.5)
  const close = () => studio.getState().setView({ cabinet: null })
  const live = !!project.template
  const add = () => {
    if (studio.getState().project.template) return setError('This design is a live template, so its parts are rebuilt from the template sizes. Unlock it (Template tab → Unlock for free-form editing) or start a new design, then add the case.')
    const r = addCase(studio.getState().project, spec)
    if ('error' in r) return setError(r.error)
    studio.getState().apply(() => r.project)
    studio.getState().select(r.project.boards.filter(b => b.groupId === r.groupId).map(b => b.id))
    close()
  }
  const inch = (k: 'W' | 'H' | 'D' | 'toe', label: string) => <InchInput label={label} value={spec[k]} onChange={v => set({ [k]: v })} />
  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/30 p-6">
      <div role="dialog" aria-label="New case" className="flex w-[880px] max-w-full flex-col gap-3 rounded-xl bg-white p-4 shadow-xl">
        <div>
          <h2 className="text-lg font-bold">New case</h2>
          <p className="text-xs text-stone-500">Set the sizes and how it goes together. The parts and cut list update as you go; nothing is added until you press Add to design.</p>
        </div>
        <div className="grid grid-cols-[1fr_1.2fr] gap-4">
          <div className="flex flex-col gap-2">
            <Label text="Kind">
              <select aria-label="Kind" className={field} value={spec.kind} onChange={e => { const k = e.target.value as CaseKind; set({ ...CASE_DEFAULTS[k], wood: spec.wood, back: spec.back }) }}>
                {(Object.keys(KIND_LABELS) as CaseKind[]).map(k => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
              </select>
            </Label>
            <div className="grid grid-cols-3 gap-2">{inch('W', 'Width')}{inch('H', 'Height')}{inch('D', 'Depth')}</div>
            {spec.kind === 'base' && <div className="grid grid-cols-3 gap-2">{inch('toe', 'Toe kick height')}</div>}
            <div className="grid grid-cols-2 gap-2">
              <Label text="Case wood">
                <select aria-label="Case wood" className={field} value={spec.wood} onChange={e => set({ wood: e.target.value })}>
                  {caseWoods.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </Label>
              <Label text="Back">
                <select aria-label="Back" className={field} value={spec.back ?? ''} onChange={e => set({ back: e.target.value || null })}>
                  <option value="">No back</option>
                  {backWoods.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </Label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Label text="Shelves">
                <input aria-label="Shelves" type="number" min={LIMITS.shelves[0]} max={LIMITS.shelves[1]} value={spec.shelves} className={field}
                  onChange={e => set({ shelves: Math.max(LIMITS.shelves[0], Math.min(LIMITS.shelves[1], Math.round(Number(e.target.value) || 0))) })} />
              </Label>
              <Label text="Shelves are">
                <select aria-label="Shelves are" className={field} value={spec.shelfMode} onChange={e => set({ shelfMode: e.target.value as CaseSpec['shelfMode'] })}>
                  <option value="adjustable">Adjustable (on pins)</option>
                  <option value="fixed">Fixed</option>
                </select>
              </Label>
            </div>
            <Label text="Construction">
              <select aria-label="Construction" className={field} value={spec.construction} onChange={e => set({ construction: e.target.value as Construction })}>
                {(Object.keys(CONSTRUCTION_LABELS) as Construction[]).map(k => <option key={k} value={k}>{CONSTRUCTION_LABELS[k]}</option>)}
              </select>
            </Label>
            {'error' in preview
              ? <p role="alert" className="rounded bg-red-50 p-2 text-sm text-red-800">{preview.error}</p>
              : <>
                <ul aria-label="How it goes together" className="list-disc space-y-0.5 pl-5 text-xs text-stone-700">{preview.notes.map(n => <li key={n}>{n}</li>)}</ul>
                {preview.warnings.length > 0 && <ul aria-label="Check before building" className="space-y-1 rounded bg-amber-50 p-2 text-xs text-amber-900">{preview.warnings.map(w => <li key={w}>⚠ {w}</li>)}</ul>}
              </>}
          </div>
          <div className="flex flex-col gap-2">
            {!('error' in preview) && <FrontView project={preview.project} />}
            <div className="max-h-56 overflow-y-auto">
              <table aria-label="Case cut list" className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-white text-stone-500"><tr><th>Qty</th><th>Part</th><th>T × W × L</th><th>Wood</th></tr></thead>
                <tbody>{rows.map((r, i) => <tr key={i} className="border-t border-stone-100"><td>{r.qty}</td><td>{r.part}</td><td>{`${formatInches(r.thickness)} × ${formatInches(r.width)} × ${formatInches(r.length)}`}</td><td>{r.woodName}</td></tr>)}</tbody>
              </table>
            </div>
          </div>
        </div>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        {live && !error && <p className="text-xs text-amber-800">This design is a live template: unlock it first to add the case to it.</p>}
        <div className="flex justify-end gap-2">
          <button onClick={close} className="rounded px-3 py-1 hover:bg-stone-100">Cancel</button>
          <button onClick={add} disabled={'error' in preview} className="rounded bg-amber-700 px-4 py-1 font-semibold text-white disabled:opacity-40">Add to design</button>
        </div>
      </div>
    </div>
  )
}
