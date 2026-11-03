import { useState } from 'react'
import { studio, useStudio, type Screen } from './store'
import { newDrawing, saveDrawing } from '../sketch/ui/session'
import { openFinishing } from '../finish/ui/FinishingSchool'
import { openShopTools } from '../tools/ui/ShopTools'
import { openLibrary } from '../library/ui/Library'
import { openJointDesigner } from '../joinery/ui/JointDesigner'
import { plans } from '../plans/plansStore'
import { BuildPlanAction } from '../drawings/ui/BuildPlanAction'

const destinations = [
  ['home', 'Dashboard'], ['master', 'Design'], ['draw', 'Drawing Board'],
  ['plans', 'My Plans'], ['library', 'Library'], ['joints', 'Joinery'],
  ['finish', 'Finishing'], ['tools', 'Shop Tools']
] as const

export function WorkspaceNavigation() {
  const screen = useStudio(s => s.screen)
  const kidsMode = useStudio(s => s.kidsMode)
  const pending = useStudio(s => s.pendingReplace)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (screen === 'kids' || kidsMode) return null

  const navigate = async (target: Screen) => {
    if (target === screen || busy || pending) return
    setBusy(true)
    setError(null)
    try {
      if (screen === 'draw' && !saveDrawing()) {
        setError('Your drawing could not be kept in the project. Resolve the drawing error before leaving.')
        return
      }
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
    } catch {
      setError('This workspace could not be opened. Your current project has not been replaced.')
    } finally { setBusy(false) }
  }

  return <div className="shrink-0 border-b border-stone-300 bg-stone-50">
    <nav aria-label="Workspace" aria-busy={busy} className="flex items-center gap-1 overflow-x-auto px-3 py-2">
      {destinations.map(([target, label]) => <button key={target} type="button" role="link"
        aria-current={target === screen ? 'page' : undefined} aria-disabled={busy || pending}
        disabled={busy || pending} onClick={() => void navigate(target)}
        className={`shrink-0 rounded px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-50 ${target === screen ? 'bg-amber-800 font-semibold text-white' : 'text-stone-700 hover:bg-stone-200'}`}>{label}</button>)}
      {screen === 'master' && <BuildPlanAction disabled={busy || pending} />}
    </nav>
    {error && <p role="alert" className="px-4 pb-2 text-sm text-red-700">{error}</p>}
  </div>
}
