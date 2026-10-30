// A photo or scan behind the drawing: add it, scale it from two points you know, fade it, remove it.
import { useState } from 'react'
import { parseInches } from '../../model/units'
import { readPicture } from '../../shop/pictureFile'
import { scaleBetween } from '../../shop/references'
import { draw, useDraw } from '../drawStore'

export function TracingPicture() {
  const r = useDraw(s => s.sketch.reference)
  const pick = useDraw(s => s.refPick)
  const [real, setReal] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const set = (patch: Partial<NonNullable<typeof r>> | null) => {
    const sk = draw.getState().sketch
    if (patch === null) { const { reference: _r, ...rest } = sk; draw.getState().replace(rest) }
    else draw.getState().replace({ ...sk, reference: { ...sk.reference!, ...patch } })
  }
  const add = async (f: File | undefined) => {
    if (!f) return
    try {
      const pic = await readPicture(f)
      const sk = draw.getState().sketch
      draw.getState().replace({ ...sk, reference: { dataUrl: pic.dataUrl, x: 0, y: 0, width: 24, height: Math.round((24 / pic.aspect) * 1e4) / 1e4, opacity: 0.5 } })
      setMsg(null)
    } catch (e) { setMsg((e as Error).message) }
  }
  const scale = () => {
    const d = parseInches(real)
    if (!d.ok) return setMsg(d.reason)
    const res = scaleBetween(r!, pick![0], pick![1], d.value)
    if ('error' in res) return setMsg(res.error)
    set({ width: res.width, height: res.height })
    draw.getState().setRefPick(null)
    setReal(''); setMsg(null)
  }
  if (!open && !pick) {
    return <button onClick={() => setOpen(true)} className="absolute bottom-2 left-2 rounded bg-white/90 px-2 py-1 text-xs font-semibold shadow hover:bg-white">🖼 Tracing picture</button>
  }
  return (
    <section aria-label="Tracing picture" className="absolute bottom-2 left-2 flex w-64 flex-col gap-1 rounded border border-sky-300 bg-sky-50/95 p-2 text-xs shadow">
      <div className="flex items-center justify-between">
        <b>Tracing picture</b>
        <button aria-label="Close tracing picture" onClick={() => { setOpen(false); draw.getState().setRefPick(null) }} className="px-1">✕</button>
      </div>
      {!r ? (
        <label className="cursor-pointer self-start rounded bg-amber-700 px-2 py-0.5 font-semibold text-white">Add picture…
          <input aria-label="Add tracing picture" type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e => { void add(e.target.files?.[0]); e.target.value = '' }} />
        </label>
      ) : (
        <>
          <label className="flex items-center gap-2">See-through
            <input aria-label="Tracing opacity" type="range" min={0.1} max={1} step={0.05} value={r.opacity} onChange={e => set({ opacity: Number(e.target.value) })} className="flex-1" />
          </label>
          <span className="text-stone-600">{`${Math.round(r.width * 100) / 100}" × ${Math.round(r.height * 100) / 100}"`}</span>
          {!pick ? (
            <div className="flex gap-1">
              <button onClick={() => draw.getState().setRefPick([])} className="rounded bg-sky-700 px-2 py-0.5 font-semibold text-white">Scale from two points</button>
              <button onClick={() => set(null)} className="rounded px-2 py-0.5 hover:bg-sky-100">Remove</button>
            </div>
          ) : pick.length < 2 ? (
            <p role="status">Click {pick.length === 0 ? 'the first' : 'the second'} point on the picture… <button onClick={() => draw.getState().setRefPick(null)} className="underline">Cancel</button></p>
          ) : (
            <div className="flex items-end gap-1">
              <label className="flex flex-1 flex-col">Real distance
                <input aria-label="Real distance" value={real} onChange={e => setReal(e.target.value)} onKeyDown={e => e.key === 'Enter' && scale()} className="rounded border border-stone-300 px-1" autoFocus />
              </label>
              <button onClick={scale} className="rounded bg-sky-700 px-2 py-0.5 font-semibold text-white">Scale</button>
            </div>
          )}
        </>
      )}
      {msg && <p role="alert" className="text-red-700">{msg}</p>}
    </section>
  )
}
