// Export the design as a 3D file or flat patterns; bring in a reference model (asking its units).
import { useMemo, useState } from 'react'
import { studio, useStudio } from '../../ui/store'
import { formatInches } from '../../model/units'
import { flatPatterns } from '../flat'
import { partMeshes } from '../meshes'
import { addModel } from '../models'
import { guessUnit, readModel, ReadError, UNIT_SCALE, type FileUnit, type ReadResult } from '../readers'
import { to3mf, toGlb, toObj, toStep, toStl, type Units } from '../writers'

type Format = 'stl' | 'obj' | '3mf' | 'glb' | 'step' | 'dxf'
const FORMATS: [Format, string][] = [
  ['stl', 'STL — 3D printing'], ['obj', 'OBJ — other 3D programs'], ['3mf', '3MF — 3D printing (keeps part names and inches)'],
  ['glb', 'glTF (.glb) — web and AR viewers'], ['step', 'STEP — other CAD programs'], ['dxf', 'DXF flat patterns — laser, CNC, templates']
]
const UNIT_NAMES: Record<FileUnit, string> = { in: 'inches', mm: 'millimetres', cm: 'centimetres', m: 'metres' }

/** Builds the file for the chosen format. */
export function exportData(format: Format, ids: string[] | undefined, units: Units): { data: Uint8Array | string; mtl?: string; parts: number } {
  const p = studio.getState().project
  if (format === 'dxf') return { data: flatPatterns(p, ids), parts: (ids ?? p.boards.map(b => b.id)).length }
  const parts = partMeshes(p, ids)
  switch (format) {
    case 'stl': return { data: toStl(parts, units), parts: parts.length }
    case 'obj': { const r = toObj(parts, p.woods, units); return { data: r.obj, mtl: r.mtl, parts: parts.length } }
    case '3mf': return { data: to3mf(parts), parts: parts.length }
    case 'glb': return { data: toGlb(parts, p.woods), parts: parts.length }
    case 'step': return { data: toStep(parts, `${p.name}.step`), parts: parts.length }
  }
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/30 p-6">
      <div role="dialog" aria-label={title} className="flex w-[520px] flex-col gap-3 rounded-xl bg-white p-4 shadow-xl">
        <h2 className="text-lg font-bold">{title}</h2>
        {children}
      </div>
    </div>
  )
}

function ExportDialog() {
  const project = useStudio(s => s.project)
  const selection = useStudio(s => s.selection)
  const [format, setFormat] = useState<Format>('stl')
  const [scope, setScope] = useState<'all' | 'selection'>(selection.length ? 'selection' : 'all')
  const [units, setUnits] = useState<Units>('in')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const close = () => studio.getState().setView({ exchange: null })
  const go = async () => {
    setBusy(true)
    try {
      const ids = scope === 'selection' ? selection : undefined
      const r = exportData(format, ids, units)
      const path = await window.aa.exportFile(format, r.data, project.name, r.mtl)
      if (path) {
        const unitText = format === 'glb' ? 'metres, as glTF requires' : (format === 'stl' || format === 'obj') && units === 'mm' ? 'millimetres' : 'inches'
        setMsg(`Exported ${r.parts} part${r.parts === 1 ? '' : 's'} to ${path.split(/[\\/]/).pop()} (${unitText})`)
      }
    } catch (e) { setMsg(`That couldn't be exported: ${(e as Error).message}`) }
    setBusy(false)
  }
  return (
    <Shell title="Export">
      <label className="flex flex-col gap-1 text-sm">Format
        <select aria-label="Format" value={format} onChange={e => setFormat(e.target.value as Format)} className="rounded border border-stone-300 px-2 py-1">
          {FORMATS.map(([f, l]) => <option key={f} value={f}>{l}</option>)}
        </select>
      </label>
      <fieldset className="flex gap-4 text-sm">
        <label className="flex items-center gap-1"><input type="radio" checked={scope === 'all'} onChange={() => setScope('all')} />The whole design ({project.boards.length} parts)</label>
        <label className="flex items-center gap-1"><input type="radio" disabled={!selection.length} checked={scope === 'selection'} onChange={() => setScope('selection')} />The selected parts ({selection.length})</label>
      </fieldset>
      {(format === 'stl' || format === 'obj') && (
        <label className="flex flex-col gap-1 text-sm">Units in the file
          <select aria-label="Units" value={units} onChange={e => setUnits(e.target.value as Units)} className="rounded border border-stone-300 px-2 py-1">
            <option value="in">Inches</option>
            <option value="mm">Millimetres (most slicers expect these)</option>
          </select>
        </label>
      )}
      {format === 'step' && <p className="text-xs text-stone-500">Each part is a solid made of flat facets: exact for flat parts, close for curved ones.</p>}
      {format === 'dxf' && <p className="text-xs text-stone-500">Each part laid flat with its holes, and its grooves as dashed lines, labelled, in rows 1" apart.</p>}
      {msg && <p role="status" className="text-sm text-green-800">{msg}</p>}
      <div className="flex justify-end gap-2">
        <button onClick={close} className="rounded px-3 py-1 hover:bg-stone-100">{msg ? 'Done' : 'Cancel'}</button>
        <button onClick={() => void go()} disabled={busy || !project.boards.length} className="rounded bg-amber-700 px-4 py-1 font-semibold text-white disabled:opacity-50">{busy ? 'Exporting…' : 'Export…'}</button>
      </div>
    </Shell>
  )
}

function ImportDialog({ name, bytes }: { name: string; bytes: Uint8Array }) {
  const read = useMemo((): ReadResult | { error: string } => {
    try { return readModel(name, bytes) } catch (e) { return { error: e instanceof ReadError ? e.message : "That file couldn't be read" } }
  }, [name, bytes])
  const [unit, setUnit] = useState<FileUnit>(() => ('error' in read ? 'in' : guessUnit(read)))
  const close = () => studio.getState().setView({ exchange: null })
  if ('error' in read) {
    return (
      <Shell title="Import a reference model">
        <p role="alert" className="text-sm text-red-700">{name}: {read.error}</p>
        <div className="flex justify-end"><button onClick={close} className="rounded px-3 py-1 hover:bg-stone-100">Close</button></div>
      </Shell>
    )
  }
  const a = read.positions
  const span = [0, 1, 2].map(k => { let lo = Infinity, hi = -Infinity; for (let i = k; i < a.length; i += 3) { lo = Math.min(lo, a[i]); hi = Math.max(hi, a[i]) } return hi - lo })
  const across = Math.max(...span)
  const size = span.map(v => formatInches(v * UNIT_SCALE[unit])).join(' × ')
  const add = () => {
    const base = name.replace(/\.[^.]+$/, '')
    studio.getState().apply(p => addModel(p, base, name.split('.').pop()!.toLowerCase(), read, unit).project)
    studio.getState().setView({ exchange: null })
  }
  return (
    <Shell title="Import a reference model">
      <p className="text-sm"><b>{name}</b> — {(a.length / 9).toLocaleString('en-US')} triangles.</p>
      {read.unit
        ? <p className="text-sm text-stone-600">The file says it&apos;s in {UNIT_NAMES[read.unit]}.</p>
        : <p className="text-sm text-stone-600">This model is {Math.round(across * 100) / 100} units across — which units are they?</p>}
      <label className="flex flex-col gap-1 text-sm">Units
        <select aria-label="Model units" value={unit} onChange={e => setUnit(e.target.value as FileUnit)} className="rounded border border-stone-300 px-2 py-1">
          {(Object.keys(UNIT_NAMES) as FileUnit[]).map(u => <option key={u} value={u}>{UNIT_NAMES[u]}</option>)}
        </select>
      </label>
      <p className="text-sm">Size: <b data-testid="model-size">{size}</b></p>
      {read.skipped ? <p role="alert" className="text-sm text-amber-800">{read.skipped} curved face{read.skipped === 1 ? '' : 's'} couldn&apos;t be read — the model may have gaps.</p> : null}
      <p className="text-xs text-stone-500">A reference model shows in grey and counts in the interference and clearance checks. It isn&apos;t a part, so it&apos;s not in the cut list.</p>
      <div className="flex justify-end gap-2">
        <button onClick={close} className="rounded px-3 py-1 hover:bg-stone-100">Cancel</button>
        <button onClick={add} className="rounded bg-amber-700 px-4 py-1 font-semibold text-white">Add to the design</button>
      </div>
    </Shell>
  )
}

export function ExchangeDialog() {
  const x = useStudio(s => s.exchange)
  if (!x) return null
  return x.kind === 'export' ? <ExportDialog /> : <ImportDialog key={x.name} name={x.name} bytes={x.bytes} />
}

/** Picks a model file and opens the import dialog for it. */
export async function startImport(): Promise<void> {
  const r = await window.aa.importModel()
  if (r) studio.getState().setView({ exchange: { kind: 'import', name: r.name, bytes: r.bytes } })
}
