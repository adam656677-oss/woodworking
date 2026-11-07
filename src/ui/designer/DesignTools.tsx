import { useState } from 'react'
import { saveDrawing } from '../../sketch/ui/session'
import { modeling, useModeling } from '../../modeling/modelStore'
import { studio, useStudio } from '../store'

/** Design workspace actions: Custom turns on the 3D modeling tools (sketch on a plane, push/pull) in this design. */
export function DesignTools() {
  const pending = useStudio(s => s.pendingReplace)
  const recovery = useStudio(s => s.recovery)
  const active = useModeling(m => m.active)
  const [error, setError] = useState<string | null>(null)
  const btn = 'rounded border border-stone-300 bg-white px-2 py-1 text-sm hover:bg-stone-100 disabled:opacity-50 aria-pressed:border-amber-800 aria-pressed:bg-amber-100'
  const toggle = () => {
    setError(null)
    if (active) { modeling.getState().stop(); return }
    const s = studio.getState()
    if (s.screen === 'draw' && !saveDrawing()) { setError('Resolve the sketch error before modeling in 3D.'); return }
    if (s.project.template) { setError('This design is a live template. Unlock it (Template tab → Unlock for free-form editing) to model on it.'); return }
    if (s.screen !== 'master') s.enterMasterShop()
    modeling.getState().start()
  }
  return <section aria-label="Design tools" className="flex flex-wrap items-center gap-2 py-1.5">
    <fieldset disabled={!!pending || !!recovery} className="flex flex-wrap items-center gap-1.5 border-l border-stone-300 pl-2">
      <legend className="sr-only">Design workspace actions</legend>
      <button type="button" className={btn} aria-pressed={active} title="Model in 3D: sketch on a plane or a part's face, then push/pull it into parts" onClick={toggle}>Custom</button>
    </fieldset>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </section>
}
