import { lazy, Suspense, useEffect } from 'react'
import { deleteBoards, duplicateBoards } from '../../model/ops'
import { studio, useStudio } from '../store'
import { CutListView } from './CutListView'
import { JointPanel } from './JointPanel'
import { PartsList } from './PartsList'
import { PropertiesPanel } from './PropertiesPanel'
import { StartPanel } from './StartPanel'
import { TemplatePanel } from './TemplatePanel'
import { Toolbar } from './Toolbar'
import { WarningsList } from './WarningsList'
import { WoodLibraryDialog } from './WoodLibraryDialog'
import { SceneBoundary } from '../three/SceneBoundary'
import { wholeGroup } from '../../assemblies/ops'
import { GroupPanel } from '../../assemblies/ui/GroupPanel'

const Scene = lazy(() => import('../three/Scene'))

function isTyping(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')
}

export function Designer() {
  const empty = useStudio(s => s.project.boards.length === 0 && !s.project.template)
  const selection = useStudio(s => s.selection)
  const error = useStudio(s => s.error)
  const recovery = useStudio(s => s.recovery)
  const cutListOpen = useStudio(s => s.cutListOpen)
  const woodsOpen = useStudio(s => s.woodsOpen)
  const kidsMode = useStudio(s => s.kidsMode)
  const project = useStudio(s => s.project)
  const whole = kidsMode ? null : wholeGroup(project, selection)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = studio.getState()
      const ctrl = e.ctrlKey || e.metaKey
      if (ctrl && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void s.save()
        return
      }
      if (isTyping(e)) return
      if (ctrl && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        s.undo()
      } else if (ctrl && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        s.redo()
      } else if (ctrl && e.key.toLowerCase() === 'd' && s.selection.length) {
        e.preventDefault()
        let ids: string[] = []
        s.apply(p => {
          const r = duplicateBoards(p, s.selection)
          ids = r.ids
          return r.project
        })
        s.select(ids)
      } else if (e.key === 'Delete' && s.selection.length) {
        s.apply(p => deleteBoards(p, s.selection))
        s.select([])
      } else if (e.key === 'Escape') {
        s.set({ measuring: false })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="flex h-full flex-col bg-stone-100 text-stone-900">
      <Toolbar />
      {error && (
        <div role="alert" className="flex items-center justify-between bg-red-100 px-4 py-2 text-sm text-red-800">
          <span>{error}</span>
          <button className="ml-4 font-bold" onClick={() => studio.getState().setError(null)} aria-label="Dismiss">✕</button>
        </div>
      )}
      {recovery && (
        <div role="dialog" aria-label="Recover work" className="flex items-center gap-3 bg-amber-100 px-4 py-2 text-sm text-amber-900">
          <span>There are unsaved changes from last time (autosave). Recover them?</span>
          <button className="rounded bg-amber-700 px-3 py-1 text-white" onClick={() => studio.getState().resolveRecovery(true)}>Recover</button>
          <button className="rounded border border-amber-700 px-3 py-1" onClick={() => studio.getState().resolveRecovery(false)}>
            {recovery.savedText === null ? 'Dismiss' : 'Open saved version'}
          </button>
        </div>
      )}
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-60 flex-col border-r border-stone-300 bg-white">
          <PartsList />
          <WarningsList />
        </aside>
        <section className="relative min-w-0 flex-1" data-testid="viewport">
          {empty ? (
            <StartPanel />
          ) : (
            <SceneBoundary>
              <Suspense fallback={<div className="p-4 text-stone-500">Loading 3D view…</div>}>
                <Scene />
              </Suspense>
            </SceneBoundary>
          )}
        </section>
        <aside className="w-72 overflow-y-auto border-l border-stone-300 bg-white p-3">
          {!kidsMode && <TemplatePanel />}
          {whole && <GroupPanel group={whole} />}
          {selection.length === 2 ? <JointPanel /> : whole && selection.length > 1 ? null : <PropertiesPanel />}
        </aside>
      </div>
      {cutListOpen && <CutListView />}
      {woodsOpen && <WoodLibraryDialog />}
    </div>
  )
}
