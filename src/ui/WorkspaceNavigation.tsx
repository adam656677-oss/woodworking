import { useState } from 'react'
import { studio, useStudio, type Screen } from './store'
import { newDrawing, saveDrawing } from '../sketch/ui/session'
import { openFinishing } from '../finish/ui/FinishingSchool'
import { openShopTools } from '../tools/ui/ShopTools'
import { openLibrary } from '../library/ui/Library'
import { openJointDesigner } from '../joinery/ui/JointDesigner'
import { plans } from '../plans/plansStore'
import { LiveBuildPlanAction } from '../drawings/ui/LiveBuildPlanAction'
import { DesignTools } from './designer/DesignTools'

const destinations = [
  ['home', 'Dashboard'], ['master', 'Design'],
  ['plans', 'My Plans'], ['library', 'Library'], ['joints', 'Joinery'],
  ['finish', 'Finishing'], ['tools', 'Shop Tools']
] as const

/** Keep the internal draw route for old sketches and the kids' workshop. */
export async function goToWorkspace(target: Screen, screen: Screen): Promise<string | null> {
  try {
    if (screen === 'draw' && !saveDrawing()) return 'Your drawing could not be kept in the project. Resolve the drawing error before leaving.'
    const s = studio.getState()
    switch (target) {
      case 'master':
        await s.checkUntitledAutosave()
        s.enterMasterShop()
        break
      case 'draw': await newDrawing('precise'); break
      case 'plans':
        s.goto('plans')
        await plans.getState().openLibrary(false, () => studio.getState().goto(screen))
        break
      case 'finish': openFinishing(screen); break
      case 'tools': openShopTools(screen); break
      case 'library': openLibrary(screen); break
      case 'joints': openJointDesigner(screen); break
      default: s.goto(target)
    }
    return null
  } catch {
    return 'This workspace could not be opened. Your current project has not been replaced.'
  }
}

export function WorkspaceNavigation() {
  const screen = useStudio(s => s.screen)
  const kidsMode = useStudio(s => s.kidsMode)
  const pending = useStudio(s => s.pendingReplace)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (screen === 'kids' || kidsMode) return null
  const inDesign = screen === 'master' || screen === 'draw'
  const navigate = async (target: Screen) => {
    if (target === screen || (target === 'master' && inDesign) || busy || pending) return
    setBusy(true)
    setError(null)
    const problem = await goToWorkspace(target, screen)
    if (problem) setError(problem)
    setBusy(false)
  }
  // Design tools share the workspace bar (wrapping only when the window is narrow) so the sketch sheet keeps its height.
  return <div className="shrink-0 border-b border-stone-300 bg-stone-50">
    <div className="flex flex-wrap items-center gap-x-2 px-3">
      <nav aria-label="Workspace" aria-busy={busy} className="flex items-center gap-1 overflow-x-auto py-2">
        {destinations.map(([target, label]) => {
          const active = target === screen || (target === 'master' && inDesign)
          return <button key={target} type="button" role="link"
            aria-current={active ? 'page' : undefined} aria-disabled={busy || pending}
            disabled={busy || pending} onClick={() => void navigate(target)}
            className={`shrink-0 rounded px-2.5 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-50 ${active ? 'bg-amber-800 font-semibold text-white' : 'text-stone-700 hover:bg-stone-200'}`}>{label}</button>
        })}
        {screen === 'master' && <LiveBuildPlanAction disabled={busy || pending} />}
      </nav>
      {inDesign && <DesignTools />}
    </div>
    {error && <p role="alert" className="px-4 pb-2 text-sm text-red-700">{error}</p>}
  </div>
}
