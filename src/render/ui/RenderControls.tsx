// The look of the 3D view (CAD or realistic), the lighting, and saving a picture.
import { useState } from 'react'
import { studio, useStudio } from '../../ui/store'
import { exportSize, LIGHTS, type LightPreset } from '../materials'
import { imageName, render, useRender, type RenderedView } from '../renderStore'

const frames = (n: number) => new Promise<void>(res => { const step = (k: number) => (k <= 0 ? res() : requestAnimationFrame(() => step(k - 1))); step(n) })

/** The look switch and, in the realistic look, the lighting; plus the picture button. In the view strip. */
export function RenderControls() {
  const mode = useRender(s => s.mode)
  const light = useRender(s => s.light)
  const effects = useRender(s => s.effects)
  const set = render.getState().set
  return (
    <>
      <label className="flex items-center gap-1">Look
        <select aria-label="Look" value={mode} onChange={e => set({ mode: e.target.value as 'cad' | 'real' })} className="rounded border border-stone-300">
          <option value="cad">Drawing (CAD)</option>
          <option value="real">Realistic wood</option>
        </select>
      </label>
      {mode === 'real' && (
        <>
          <label className="flex items-center gap-1">Light
            <select aria-label="Lighting" value={light} onChange={e => set({ light: e.target.value as LightPreset })} className="rounded border border-stone-300">
              {(Object.keys(LIGHTS) as LightPreset[]).map(k => <option key={k} value={k}>{LIGHTS[k].label}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-1" title="Turn off on a slow computer"><input type="checkbox" checked={effects} onChange={e => set({ effects: e.target.checked })} />Shadows</label>
        </>
      )}
      <button className="rounded border border-stone-300 px-2 hover:bg-stone-100" onClick={() => set({ exportOpen: true })}>📷 Picture…</button>
    </>
  )
}

/** Kids: one big button between the plain look and real wood. */
export function KidsLookButton() {
  const mode = useRender(s => s.mode)
  return (
    <button onClick={() => render.getState().set({ mode: mode === 'real' ? 'cad' : 'real' })} className={`rounded px-2 py-1 text-sm ${mode === 'real' ? 'bg-amber-700 text-white' : 'hover:bg-stone-200'}`}>
      🌳 Real wood
    </button>
  )
}

/** Front, 3D and exploded pictures of the design for the plan packet, from the view as it's set up (look, light). */
export async function renderViews(): Promise<RenderedView[]> {
  const s = studio.getState()
  const saved = { view: s.view, explode: s.explode }
  const out: RenderedView[] = []
  const shots: [RenderedView['key'], string, typeof s.view, number][] = [['iso', '3D view', '3d', 0], ['front', 'Front', 'front', 0], ['exploded', 'Exploded', '3d', 0.6]]
  try {
    for (const [key, label, view, explode] of shots) {
      studio.getState().set({ view })
      studio.getState().setView({ explode })
      await frames(3)
      window.dispatchEvent(new Event('aa:zoom-fit'))
      await frames(3)
      const r = render.getState().capture?.({ scale: 2, transparent: false })
      if (r) out.push({ key, label, dataUrl: r.dataUrl })
    }
  } finally {
    studio.getState().set({ view: saved.view })
    studio.getState().setView({ explode: saved.explode })
  }
  render.setState({ views: out })
  return out
}

/** Save a picture of the view: 1×, 2× or 4× its size, optionally on a clear background. */
export function PictureDialog() {
  const open = useRender(s => s.exportOpen)
  const views = useRender(s => s.views)
  const name = useStudio(s => s.project.name)
  const [scale, setScale] = useState(2)
  const [clear, setClear] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  if (!open) return null
  const view = document.querySelector('[data-testid="viewport"] canvas') as HTMLCanvasElement | null
  const css = view ? { w: view.clientWidth, h: view.clientHeight } : { w: 1200, h: 800 }
  const size = exportSize(css.w, css.h, scale)
  const close = () => { render.getState().set({ exportOpen: false }); setMsg(null) }
  const save = async () => {
    const r = render.getState().capture?.({ scale, transparent: clear })
    if (!r) return setMsg("Couldn't make the picture — the 3D view isn't ready.")
    const path = await window.aa.savePng(imageName(name), r.dataUrl)
    setMsg(path ? `Saved ${r.width} × ${r.height} px to ${path}` : null)
  }
  const views3 = async () => {
    setBusy(true)
    try { const v = await renderViews(); setMsg(`${v.length} pictures ready — they're in the plan packet (Drawings → Plan packet).`) } finally { setBusy(false) }
  }
  return (
    <div role="dialog" aria-label="Save a picture" className="fixed inset-0 z-40 flex items-center justify-center bg-black/30" onKeyDown={e => e.key === 'Escape' && close()}>
      <div className="flex w-[28rem] flex-col gap-3 rounded-lg bg-white p-4 shadow-xl">
        <h2 className="text-lg font-bold">Save a picture</h2>
        <p className="text-sm text-stone-600">A picture of the 3D view as it is now — camera, look and light.</p>
        <fieldset className="flex gap-3 text-sm">
          <legend className="mb-1 text-xs font-semibold">Size</legend>
          {[1, 2, 4].map(k => (
            <label key={k} className="flex items-center gap-1"><input type="radio" name="scale" checked={scale === k} onChange={() => setScale(k)} />{k}×</label>
          ))}
          <span data-testid="picture-size" className="text-stone-600">{size.width} × {size.height} px</span>
        </fieldset>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={clear} onChange={e => setClear(e.target.checked)} />Clear background (no floor)</label>
        <div className="flex flex-wrap gap-2">
          <button className="rounded bg-amber-700 px-3 py-1 text-sm font-semibold text-white" onClick={() => void save()}>Save PNG…</button>
          <button disabled={busy} className="rounded border px-3 py-1 text-sm hover:bg-stone-100 disabled:opacity-40" onClick={() => void views3()}>{busy ? 'Rendering…' : 'Render views for the plan packet'}</button>
          <button className="ml-auto rounded border px-3 py-1 text-sm hover:bg-stone-100" onClick={close}>Close</button>
        </div>
        {views.length > 0 && <div className="flex gap-2">{views.map(v => <img key={v.key} src={v.dataUrl} alt={`Rendered ${v.label}`} className="h-16 rounded border" />)}</div>}
        {msg && <p role="status" className="text-sm text-stone-700">{msg}</p>}
      </div>
    </div>
  )
}
