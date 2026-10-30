// The Pictures panel: reference photos and scans to design over in 3D.
import { useState } from 'react'
import type { Reference } from '../../model/types'
import { parseInches } from '../../model/units'
import { InchInput } from '../../ui/designer/InchInput'
import { studio, useStudio } from '../../ui/store'
import { readPicture } from '../pictureFile'
import { addReference, PLANE_NAMES, removeReference, scaleReference, updateReference, type Plane } from '../references'

const apply = (fn: Parameters<ReturnType<typeof studio.getState>['apply']>[0]) => studio.getState().apply(fn)

function PictureRow({ r }: { r: Reference }) {
  const pick = useStudio(s => s.refPick)
  const [real, setReal] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const picking = pick?.id === r.id
  const set = (patch: Partial<Reference>) => apply(p => updateReference(p, r.id, patch))
  const scale = () => {
    const d = parseInches(real)
    if (!d.ok) return setMsg(d.reason)
    const res = scaleReference(studio.getState().project, r.id, pick!.pts[0], pick!.pts[1], d.value)
    if ('error' in res) return setMsg(res.error)
    apply(() => res)
    studio.getState().setView({ refPick: null })
    setReal(''); setMsg(null)
  }
  return (
    <li className="flex flex-col gap-1 rounded border border-stone-200 bg-white p-2" aria-label={`Picture ${r.name}`}>
      <div className="flex items-center gap-2">
        <img src={r.dataUrl} alt="" className="h-8 w-8 rounded object-cover" />
        <span className="flex-1 truncate font-semibold">{r.name}</span>
        <button aria-label={r.hidden ? `Show ${r.name}` : `Hide ${r.name}`} onClick={() => set({ hidden: !r.hidden })} className="px-1">{r.hidden ? '🙈' : '👁'}</button>
        <button aria-label={r.locked ? `Unlock ${r.name}` : `Lock ${r.name}`} onClick={() => set({ locked: !r.locked })} className="px-1">{r.locked ? '🔒' : '🔓'}</button>
        <button aria-label={`Remove ${r.name}`} onClick={() => apply(p => removeReference(p, r.id))} className="px-1 text-stone-500 hover:text-red-700">✕</button>
      </div>
      <label className="flex items-center gap-2 text-xs">See-through
        <input aria-label={`Opacity of ${r.name}`} type="range" min={0.1} max={1} step={0.05} value={r.opacity} onChange={e => set({ opacity: Number(e.target.value) })} className="flex-1" />
      </label>
      {!r.locked && (
        <>
          <label className="flex flex-col text-xs text-stone-600">Plane
            <select aria-label={`Plane of ${r.name}`} value={r.plane} onChange={e => set({ plane: e.target.value as Plane })} className="rounded border border-stone-300 px-1 py-0.5 text-sm">
              {(Object.keys(PLANE_NAMES) as Plane[]).map(k => <option key={k} value={k}>{PLANE_NAMES[k]}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-3 gap-1">
            {(['x', 'y', 'z'] as const).map(a => (
              <InchInput key={a} label={`${a.toUpperCase()} of ${r.name}`} allowZero value={r.position[a]} onChange={v => set({ position: { ...r.position, [a]: v } })} />
            ))}
          </div>
          <p className="text-xs text-stone-500">{`${Math.round(r.width * 100) / 100}" × ${Math.round(r.height * 100) / 100}"`}</p>
          {!picking ? (
            <button onClick={() => studio.getState().setView({ refPick: { id: r.id, pts: [] } })} className="self-start rounded bg-sky-700 px-2 py-0.5 text-xs font-semibold text-white">Scale from two points</button>
          ) : pick!.pts.length < 2 ? (
            <p role="status" className="text-xs text-sky-800">Click {pick!.pts.length === 0 ? 'the first' : 'the second'} point on the picture… <button onClick={() => studio.getState().setView({ refPick: null })} className="underline">Cancel</button></p>
          ) : (
            <div className="flex items-end gap-1">
              <label className="flex flex-1 flex-col text-xs">Real distance between the points
                <input aria-label="Real distance" value={real} onChange={e => setReal(e.target.value)} onKeyDown={e => e.key === 'Enter' && scale()} className="rounded border border-stone-300 px-1" autoFocus />
              </label>
              <button onClick={scale} className="rounded bg-sky-700 px-2 py-0.5 text-xs font-semibold text-white">Scale</button>
              <button onClick={() => studio.getState().setView({ refPick: null })} className="px-1 text-xs underline">Cancel</button>
            </div>
          )}
          {msg && <p role="alert" className="text-xs text-red-700">{msg}</p>}
        </>
      )}
    </li>
  )
}

const NONE: Reference[] = []

export function PicturesPanel() {
  const open = useStudio(s => s.picturesOpen)
  const refs = useStudio(s => s.project.references) ?? NONE
  const [plane, setPlane] = useState<Plane>('front')
  const [err, setErr] = useState<string | null>(null)
  if (!open) return null
  const add = async (f: File | undefined) => {
    if (!f) return
    try {
      const pic = await readPicture(f)
      apply(p => addReference(p, { ...pic, plane }).project)
      setErr(null)
    } catch (e) { setErr((e as Error).message) }
  }
  return (
    <section aria-label="Pictures" className="mb-3 flex flex-col gap-2 rounded border border-sky-300 bg-sky-50 p-2 text-sm">
      <div className="flex items-center justify-between">
        <h3 className="font-bold">Pictures to design over</h3>
        <button aria-label="Close pictures" onClick={() => studio.getState().setView({ picturesOpen: false, refPick: null })} className="px-1 text-stone-500 hover:text-stone-800">✕</button>
      </div>
      <p className="text-xs text-stone-600">Add a photo or scan, scale it with one measurement you know, then build your parts over it.</p>
      <div className="flex items-center gap-1">
        <select aria-label="New picture plane" value={plane} onChange={e => setPlane(e.target.value as Plane)} className="min-w-0 flex-1 rounded border border-stone-300 px-1 py-0.5 text-xs">
          {(Object.keys(PLANE_NAMES) as Plane[]).map(k => <option key={k} value={k}>{PLANE_NAMES[k]}</option>)}
        </select>
        <label className="cursor-pointer rounded bg-amber-700 px-2 py-0.5 text-xs font-semibold text-white">Add picture…
          <input aria-label="Add picture" type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e => { void add(e.target.files?.[0]); e.target.value = '' }} />
        </label>
      </div>
      {err && <p role="alert" className="text-xs text-red-700">{err}</p>}
      <ul className="flex flex-col gap-2">{refs.map(r => <PictureRow key={r.id} r={r} />)}</ul>
    </section>
  )
}
