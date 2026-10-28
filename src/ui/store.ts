// The app's single store: the project (with undo history), selection, file state and screen.
import { createStore, useStore } from 'zustand'
import { deserialize, ProjectFileError, serialize } from '../model/fileFormat'
import { History } from '../model/history'
import { newId } from '../model/ids'
import type { OpError } from '../model/ops'
import type { Project, Wood } from '../model/types'
import { validate, type Warning } from '../model/validate'
import { cloneWoods, emptyProject } from '../model/woods'
import { applyTemplate, findTemplate } from '../templates'

export type Screen = 'home' | 'kids' | 'master'
export type View = '3d' | 'front' | 'side' | 'top'
type Snapshot = { project: Project; selection: string[] }

export type Recovery = { path: string | null; savedText: string | null; autosaveText: string; backupPath: string | null }

export type StudioState = {
  screen: Screen
  project: Project
  selection: string[]
  filePath: string | null
  dirty: boolean
  warnings: Warning[]
  error: string | null
  recovery: Recovery | null
  userWoods: Wood[]
  view: View
  measuring: boolean
  cutListOpen: boolean
  woodsOpen: boolean
  canUndo: boolean
  canRedo: boolean

  goto(screen: Screen): void
  apply(fn: (p: Project) => Project | OpError): void
  undo(): void
  redo(): void
  select(ids: string[]): void
  newFromTemplate(id: string): void
  newBlank(): void
  open(): Promise<void>
  resolveRecovery(useAutosave: boolean): void
  save(): Promise<boolean>
  saveAs(): Promise<boolean>
  autosaveNow(): Promise<void>
  checkUntitledAutosave(): Promise<void>
  loadUserWoods(): Promise<void>
  addUserWood(w: Omit<Wood, 'id' | 'builtIn'>): Promise<void>
  updateUserWood(id: string, patch: Partial<Wood>): Promise<void>
  removeUserWood(id: string): Promise<void>
  setError(msg: string | null): void
  set(patch: Partial<Pick<StudioState, 'view' | 'measuring' | 'cutListOpen' | 'woodsOpen'>>): void
}

export const APP_NAME = 'A&A Woodworking Studio'

const isError = (r: Project | OpError): r is OpError => 'error' in r
const api = () => window.aa

function nameFromPath(path: string): string {
  const base = path.split(/[\\/]/).pop() ?? path
  return base.replace(/\.aaw$/i, '')
}

export function createStudioStore() {
  let history = new History<Snapshot>({ project: emptyProject('Untitled'), selection: [] })

  return createStore<StudioState>()((set, get) => {
    /** Publish the history's current snapshot into state. */
    const sync = (dirty: boolean) => {
      const { project, selection } = history.current
      set({ project, selection, warnings: validate(project), dirty, canUndo: history.canUndo, canRedo: history.canRedo })
      api()?.setDirty(dirty)
    }
    const start = (project: Project, filePath: string | null, dirty: boolean) => {
      history = new History<Snapshot>({ project, selection: [] })
      set({ filePath, screen: 'master', error: null, recovery: null })
      sync(dirty)
    }
    const loadText = (text: string, path: string | null, backupPath: string | null, dirty: boolean) => {
      try {
        start(deserialize(text), path, dirty)
      } catch (e) {
        const msg = e instanceof ProjectFileError ? e.message : 'This project file could not be opened.'
        set({ error: backupPath ? `${msg} Your backup is at ${backupPath}` : msg, recovery: null })
      }
    }
    const newProject = (name: string) => emptyProject(name, get().userWoods)
    const persistWoods = async (woods: Wood[]) => {
      set({ userWoods: woods })
      await api()?.saveUserWoods(woods)
    }

    return {
      screen: 'home',
      project: history.current.project,
      selection: [],
      filePath: null,
      dirty: false,
      warnings: [],
      error: null,
      recovery: null,
      userWoods: [],
      view: '3d',
      measuring: false,
      cutListOpen: false,
      woodsOpen: false,
      canUndo: false,
      canRedo: false,

      goto: screen => set({ screen }),

      apply: fn => {
        const result = fn(get().project)
        if (isError(result)) {
          set({ error: result.error })
          return
        }
        if (result === get().project) return
        const ids = new Set(result.boards.map(b => b.id))
        history.push({ project: result, selection: get().selection.filter(id => ids.has(id)) })
        set({ error: null })
        sync(true)
      },
      undo: () => {
        history.undo()
        sync(true)
      },
      redo: () => {
        history.redo()
        sync(true)
      },
      select: ids => {
        // Selection is part of the current snapshot so undo brings it back, but selecting is not an undo step.
        const cur = history.current
        ;(cur as Snapshot).selection = ids
        set({ selection: ids })
      },

      newFromTemplate: id => {
        const t = findTemplate(id)
        if (!t) return
        start(applyTemplate(newProject(t.name), id), null, true)
      },
      newBlank: () => start(newProject('Untitled'), null, false),

      open: async () => {
        const r = await api().openProject()
        if (!r) return
        if (r.autosaveNewer && r.autosaveText) {
          set({ recovery: { path: r.path, savedText: r.text, autosaveText: r.autosaveText, backupPath: r.backupPath } })
          return
        }
        loadText(r.text, r.path, r.backupPath, false)
      },
      resolveRecovery: useAutosave => {
        const rec = get().recovery
        if (!rec) return
        if (useAutosave) loadText(rec.autosaveText, rec.path, rec.backupPath, true)
        else if (rec.savedText !== null) loadText(rec.savedText, rec.path, rec.backupPath, false)
        else set({ recovery: null })
      },

      save: async () => {
        const path = get().filePath
        if (!path) return get().saveAs()
        try {
          await api().saveProject(path, serialize(get().project))
        } catch (e) {
          set({ error: (e as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') })
          return false
        }
        set({ dirty: false })
        api().setDirty(false)
        return true
      },
      saveAs: async () => {
        try {
          const path = await api().saveAs(serialize(get().project), get().project.name)
          if (!path) return false
          const name = nameFromPath(path)
          const project = { ...get().project, name }
          history.current.project = project
          set({ filePath: path, project, dirty: false })
          api().setDirty(false)
          return true
        } catch (e) {
          set({ error: (e as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') })
          return false
        }
      },
      autosaveNow: async () => {
        if (!get().dirty || get().screen !== 'master') return
        try {
          await api().writeAutosave(get().filePath, serialize(get().project))
        } catch {
          // Autosave failures never interrupt work; the next save reports real problems.
        }
      },
      checkUntitledAutosave: async () => {
        const text = await api().readUntitledAutosave()
        if (text) set({ recovery: { path: null, savedText: null, autosaveText: text, backupPath: null } })
      },

      loadUserWoods: async () => {
        const woods = (await api()?.loadUserWoods()) ?? []
        set({ userWoods: Array.isArray(woods) ? woods : [] })
      },
      addUserWood: async w => {
        const wood: Wood = { ...w, id: newId('w'), builtIn: false }
        await persistWoods([...get().userWoods, wood])
        // Make it selectable right away in the open project; the project keeps its own copy.
        const p = get().project
        if (!p.woods.some(x => x.id === wood.id)) {
          const project = { ...p, woods: [...p.woods, ...cloneWoods([wood])] }
          history.current.project = project
          set({ project })
        }
      },
      updateUserWood: async (id, patch) => {
        await persistWoods(get().userWoods.map(w => (w.id === id ? { ...w, ...patch, id, builtIn: false } : w)))
        get().apply(p => ({ ...p, woods: p.woods.map(w => (w.id === id ? { ...w, ...patch, id, builtIn: false } : w)) }))
      },
      removeUserWood: async id => {
        await persistWoods(get().userWoods.filter(w => w.id !== id))
      },

      setError: msg => set({ error: msg }),
      set: patch => set(patch)
    }
  })
}

export const studio = createStudioStore()
export function useStudio<T>(selector: (s: StudioState) => T): T {
  return useStore(studio, selector)
}
export { APP_NAME as appName }
