import { useState } from 'react'
import { newDrawing, openDrawing, saveDrawing } from '../../sketch/ui/session'
import { studio, useStudio } from '../store'
import { startCustomDesign } from './customDesign'
import { ProfileReview } from './ProfileReview'

export function DesignTools() {
  const screen = useStudio(s => s.screen)
  const savedSketches = useStudio(s => s.project.sketches)
  const sketches = savedSketches ?? []
  const pending = useStudio(s => s.pendingReplace)
  const recovery = useStudio(s => s.recovery)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const run = async (action: () => void | Promise<void>) => {
    if (busy || pending || recovery) return
    setBusy(true)
    setError(null)
    try { await action() } catch { setError('The design action could not finish. Check the current project before continuing.') }
    finally { setBusy(false) }
  }
  const keepSketch = () => {
    if (studio.getState().screen !== 'draw' || saveDrawing()) return true
    setError('Resolve the sketch error before changing views.')
    return false
  }
  const btn = 'rounded border border-stone-300 bg-white px-3 py-1.5 text-sm hover:bg-stone-100 disabled:opacity-50'
  return <section aria-label="Design tools" className="border-t border-stone-200 px-3 py-2">
    <fieldset disabled={busy || pending || !!recovery} className="flex flex-wrap items-center gap-2">
      <legend className="sr-only">Design workspace actions</legend>
      <button type="button" className={btn} onClick={() => void run(() => { if (!startCustomDesign()) setError('Finish the pending save or recovery before starting Custom.') })}>Custom</button>
      <span className="mx-1 text-sm font-semibold text-stone-600">View</span>
      <button type="button" className={btn} aria-pressed={screen === 'draw'} onClick={() => void run(async () => {
        if (screen === 'draw') return
        const last = studio.getState().project.sketches?.at(-1)
        if (last) await openDrawing(last)
        else await newDrawing('precise')
      })}>Sketch</button>
      <button type="button" className={btn} aria-pressed={screen === 'master'} onClick={() => void run(() => { if (keepSketch()) studio.getState().enterMasterShop() })}>3D</button>
      <button type="button" className={btn} onClick={() => void run(async () => { if (keepSketch()) await newDrawing('precise') })}>New sketch</button>
      {sketches.length > 0 && <label className="flex items-center gap-2 text-sm">Saved sketches
        <select aria-label="Open saved sketch" value="" className="rounded border border-stone-300 bg-white px-2 py-1.5" onChange={e => {
          const id = e.target.value
          void run(async () => {
            if (!keepSketch()) return
            const sketch = studio.getState().project.sketches?.find(s => s.id === id)
            if (sketch) await openDrawing(sketch)
          })
        }}>
          <option value="">Choose a sketch…</option>
          {sketches.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </label>}
    </fieldset>
    <p className="mt-2 text-xs text-stone-600">Custom starts a new project; New sketch adds to this project. Draw and dimension a closed profile, make a part, then generate drawings and cut lists in 3D.</p>
    {screen === 'draw' && <ProfileReview />}
    {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
  </section>
}
