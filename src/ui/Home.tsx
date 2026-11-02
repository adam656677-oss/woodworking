import { useEffect, useState } from 'react'
import { lowStock, tools, useTools } from '../tools/store'
import { openShopTools } from '../tools/ui/ShopTools'
import { openFinishing } from '../finish/ui/FinishingSchool'
import { studio, useStudio } from './store'
import { BackupBar } from '../family/ui/BackupBar'
import { openHelper } from '../smart/ui/SmartDialogs'

const card = 'flex flex-col items-start gap-2 rounded-xl border border-stone-200 bg-white p-5 text-left shadow-sm transition hover:border-amber-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600'

export function Home() {
  const inv = useTools(s => s.inventory)
  const project = useStudio(s => s.project)
  const dirty = useStudio(s => s.dirty)
  const filePath = useStudio(s => s.filePath)
  const projectKey = useStudio(s => s.projectKey)
  const kidsMode = useStudio(s => s.kidsMode)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!tools.getState().loaded) void tools.getState().load().catch(() => setError('Shop inventory could not be loaded. Try opening Shop Tools.'))
  }, [])
  const low = lowStock(inv)
  const hasProject = projectKey > 0 || !!filePath || dirty || project.boards.length > 0
  const enterMaster = async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await studio.getState().checkUntitledAutosave()
      studio.getState().enterMasterShop()
    } catch {
      setError('The recovery check could not finish. Your current project has not been replaced.')
    } finally { setBusy(false) }
  }

  return (
    <main className="h-full overflow-y-auto bg-stone-100 text-stone-900">
      <div className="mx-auto flex min-h-full max-w-7xl flex-col gap-8 px-5 py-8 sm:px-8 lg:px-12">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-200 pb-6">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-amber-800">Your woodworking workspace</p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">A&amp;A Woodworking Studio</h1>
            <p className="mt-2 text-stone-600">Design it together. Build it together.</p>
          </div>
          <button type="button" onClick={() => openHelper('settings')} className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm hover:bg-stone-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">Smart Helpers settings</button>
        </header>

        {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800">{error}</p>}

        <section aria-labelledby="project-heading" className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8 lg:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">{hasProject ? 'Current session' : 'Start designing'}</p>
            <h2 id="project-heading" className="mt-3 break-words text-2xl font-semibold">{hasProject ? project.name : 'From an idea to a buildable plan'}</h2>
            <p className="mt-3 max-w-xl text-stone-600">{hasProject
              ? `${project.boards.length} parts in the current design. ${kidsMode ? 'This session is from the Simple Designer; Master Shop opens it with adult tools.' : 'Return to your model, drawings, and fabrication tools.'}`
              : 'Open Master Shop to start with a template, create a blank design, or open a saved project.'}</p>
            {hasProject && <p className="mt-4 text-sm text-stone-600">{dirty ? 'Unsaved changes' : filePath ? 'Saved project' : 'Not saved to a project file'}</p>}
            <button type="button" disabled={busy} onClick={() => void enterMaster()} className="mt-6 rounded-lg bg-amber-800 px-5 py-3 font-semibold text-white hover:bg-amber-900 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
              {busy ? 'Checking recovery…' : 'Master Shop'}
            </button>
          </div>
          <aside className="rounded-2xl border border-stone-200 bg-stone-50 p-6" aria-labelledby="workflow-heading">
            <h2 id="workflow-heading" className="font-semibold">A connected project workflow</h2>
            <ol className="mt-5 list-inside list-decimal space-y-4 text-sm text-stone-600">
              <li>Design boards, shapes, and assemblies.</li>
              <li>Review dimensions and drawings.</li>
              <li>Plan cuts and materials.</li>
              <li>Follow the build in Shop Mode.</li>
            </ol>
          </aside>
        </section>

        <section aria-labelledby="workshop-heading">
          <h2 id="workshop-heading" className="mb-4 text-lg font-semibold">Workshop resources</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <button type="button" onClick={() => studio.getState().goto('kids')} className={card}>
              <span className="text-xs font-semibold uppercase tracking-wider text-sky-800">Learn together</span>
              <span className="text-xl font-semibold">Kids' Workshop</span>
              <span className="text-sm text-stone-600">A separate, simpler space for young makers.</span>
            </button>
            <button type="button" onClick={() => openFinishing('home')} className={card}>
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800">Surface &amp; finish</span>
              <span className="text-xl font-semibold">Finishing School</span>
              <span className="text-sm text-stone-600">Explore finishing guidance and schedules.</span>
            </button>
            <button type="button" onClick={() => openShopTools('home')} className={card}>
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-800">Prepare the shop</span>
              <span className="text-xl font-semibold">Shop Tools</span>
              <span className="text-sm text-stone-600">Open calculators, inventory, and shop utilities.</span>
            </button>
          </div>
        </section>

        {low.length > 0 && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
          Running low: {low.join('; ')} — <button type="button" className="underline" onClick={() => openShopTools('home', 'inventory')}>see the inventory</button>
        </p>}
        <footer className="mt-auto border-t border-stone-200 pt-5"><BackupBar /></footer>
      </div>
    </main>
  )
}
