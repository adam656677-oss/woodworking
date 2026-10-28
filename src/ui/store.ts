// The app's single store: the project (with undo history), selection, file state and screen.
import { createStore, useStore } from 'zustand'
import { deserialize, ProjectFileError, serialize } from '../model/fileFormat'
import { History } from '../model/history'
import { newId } from '../model/ids'
import type { OpError } from '../model/ops'
import type { Project, Wood } from '../model/types'
import { validate, type Warning } from '../model/validate'
import { cloneWoods, emptyProject } from '../model/woods'
import { applyTemplate, findTemplate, unlock } from '../templates'

export type Screen = 'home' | 'kids' | 'master' | 'plans'
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
  /** Bumps whenever a different project is started or opened (the 3D view refits). */
  projectKey: number
  /** True while asking whether to save unsaved work before it is replaced. */
  pendingReplace: boolean
  /** The designer is the kids' Simple Designer (fewer tools, 1/8" sizes, butt joints, kid woods). */
  kidsMode: boolean

  goto(screen: Screen): void
  /** Open the kids' Simple Designer: back to the kid's design if there is one, else a blank one. */
  enterKidsDesigner(): boolean
  /** Open the full Master Shop designer (kids' limits off; the current project stays). */
  enterMasterShop(): void
  /** Open a design given as text (a plan's attached design) in the Master Shop, as an unsaved copy. */
  openDesignText(text: string): void
  apply(fn: (p: Project) => Project | OpError): void
  undo(): void
  redo(): void
  select(ids: string[]): void
  newFromTemplate(id: string): void
  newBlank(): void
  open(): Promise<void>
  resolveRecovery(useAutosave: boolean): void
  resolvePending(choice: 'save' | 'discard' | 'cancel'): Promise<void>
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

const LIVE_TEMPLATE = 'This is a live template — change its sizes in the template panel, or Unlock to edit parts freely.'

export function createStudioStore() {
  let history = new History<Snapshot>({ project: emptyProject('Untitled'), selection: [] })
  /** What to do once the person answers the unsaved-work question. */
  let pending: (() => void | Promise<void>) | null = null
  let untitledChecked = false

  return createStore<StudioState>()((set, get) => {
    /** Publish the history's current snapshot into state. */
    const sync = (dirty: boolean) => {
      const { project, selection } = history.current
      set({ project, selection, warnings: validate(project), dirty, canUndo: history.canUndo, canRedo: history.canRedo })
      api()?.setDirty(dirty)
    }
    const start = (project: Project, filePath: string | null, dirty: boolean) => {
      history = new History<Snapshot>({ project, selection: [] })
      set({ filePath, screen: 'master', error: null, recovery: null, projectKey: get().projectKey + 1 })
      sync(dirty)
    }
    const loadText = (text: string, path: string | null, backupPath: string | null, dirty: boolean) => {
      try {
        const project = deserialize(text)
        // The file name is the project's name (a file renamed in Explorer shows its new name).
        // The Simple Designer has no template panel, so a template project opens unlocked there.
        const opened = get().kidsMode ? unlock(project) : project
        start(path ? { ...opened, name: nameFromPath(path) } : opened, path, dirty)
      } catch (e) {
        const msg = e instanceof ProjectFileError ? e.message : 'This project file could not be opened.'
        set({ error: backupPath ? `${msg} Your backup is at ${backupPath}` : msg, recovery: null })
      }
    }
    const newProject = (name: string) => emptyProject(name, get().userWoods)
    /** Run an action that replaces the current project, asking first if there is unsaved work. */
    const guard = async (action: () => void | Promise<void>) => {
      if (get().dirty) {
        pending = action
        set({ pendingReplace: true })
        return
      }
      await action()
    }
    const afterSave = async (path: string, wasUntitled: boolean) => {
      // The saved file is now the newest copy: its autosave (and an untitled one it came from) are spent.
      await api().deleteAutosave?.(path)
      if (wasUntitled) await api().deleteAutosave?.(null)
    }
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
      projectKey: 0,
      pendingReplace: false,
      kidsMode: false,

      goto: screen => set({ screen }),
      enterKidsDesigner: () => {
        if (get().kidsMode) {
          set({ screen: 'master' })
          return true
        }
        // A grown-up's unsaved Master Shop work is never put in front of a kid to save or throw away.
        if (get().dirty) return false
        void guard(() => {
          start(newProject('My design'), null, false)
          set({ kidsMode: true })
        })
        return true
      },
      enterMasterShop: () => set({ kidsMode: false, screen: 'master' }),
      openDesignText: text => {
        set({ kidsMode: false })
        void guard(() => loadText(text, null, null, false))
      },

      apply: fn => {
        const result = fn(get().project)
        if (isError(result)) {
          set({ error: result.error })
          return
        }
        if (result === get().project) return
        const prev = get().project
        // Template parts are rebuilt from the template sizes, so a direct edit would be silently lost.
        if (prev.template && result.template === prev.template && (result.boards !== prev.boards || result.joints !== prev.joints)) {
          set({ error: LIVE_TEMPLATE })
          return
        }
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
        // An untouched template is nothing the person would lose, so it starts clean.
        void guard(() => start(applyTemplate(newProject(t.name), id), null, false))
      },
      newBlank: () => void guard(() => start(newProject('Untitled'), null, false)),

      open: () => guard(async () => {
        const r = await api().openProject()
        if (!r) return
        if (r.autosaveNewer && r.autosaveText) {
          set({ recovery: { path: r.path, savedText: r.text, autosaveText: r.autosaveText, backupPath: r.backupPath } })
          return
        }
        loadText(r.text, r.path, r.backupPath, false)
      }),
      resolveRecovery: useAutosave => {
        const rec = get().recovery
        if (!rec) return
        if (useAutosave) {
          // Recovered work is unsaved until saved, so leave the autosave in place until then.
          set({ recovery: null })
          void guard(() => loadText(rec.autosaveText, rec.path, rec.backupPath, true))
        } else if (rec.savedText !== null) {
          loadText(rec.savedText, rec.path, rec.backupPath, false)
        } else {
          // Dismissing an untitled recovery throws that work away for good.
          set({ recovery: null })
          void api().deleteAutosave?.(null)
        }
      },
      resolvePending: async choice => {
        const action = pending
        pending = null
        set({ pendingReplace: false })
        if (!action || choice === 'cancel') return
        if (choice === 'save' && !(await get().save())) return
        await action()
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
        await afterSave(path, false)
        return true
      },
      saveAs: async () => {
        try {
          const path = await api().saveAs(serialize(get().project), get().project.name)
          if (!path) return false
          const wasUntitled = get().filePath === null
          const name = nameFromPath(path)
          const renamed = name !== get().project.name
          const project = { ...get().project, name }
          history.current.project = project
          set({ filePath: path, project })
          // Re-save so the file itself carries the name it was saved under.
          if (renamed) await api().saveProject(path, serialize(project))
          set({ dirty: false })
          api().setDirty(false)
          await afterSave(path, wasUntitled)
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
        if (untitledChecked) return
        untitledChecked = true
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
