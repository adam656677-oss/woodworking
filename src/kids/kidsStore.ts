// The Kids' Workshop store: the child's progress, which page is showing, and the PIN-guarded actions.
import { createStore, useStore } from 'zustand'
import { findProject } from './content'
import { projectUnlocked } from './logic'
import { newProgress, today, type ChildTier, type Progress } from './progress'

export type KidsPage =
  | { name: 'home' }
  | { name: 'path' }
  | { name: 'lesson'; id: string; card: number; back: 'path' | 'learn' }
  | { name: 'quiz'; id: string }
  | { name: 'projects' }
  | { name: 'project'; id: string }
  | { name: 'learn' }
  | { name: 'badges' }
  | { name: 'parent' }
  | { name: 'sheet'; id: string }
  | { name: 'certificate'; badgeId: string }
  | { name: 'plans' }

export type KidsState = {
  loaded: boolean
  progress: Progress
  notice: string | null
  page: KidsPage
  load(): Promise<void>
  go(page: KidsPage): void
  markLessonOpened(id: string): Promise<void>
  passQuiz(quizId: string): Promise<void>
  confirmBuilt(projectId: string, pin: string): Promise<boolean>
  setPhoto(projectId: string, photo: string): Promise<void>
  setTier(tier: ChildTier, pin: string): Promise<boolean>
  resetQuiz(quizId: string, pin: string): Promise<boolean>
  setNameAndPin(name: string, pin: string): Promise<void>
}

const api = () => window.aa

export function createKidsStore() {
  return createStore<KidsState>()((set, get) => {
    /** Change progress and save it; the change shows right away even if the save is slow. */
    /** Set when saved progress could not be read: saving now would overwrite it with a blank record. */
    let loadFailed = false
    const update = async (fn: (p: Progress) => Progress) => {
      const next = fn(get().progress)
      set({ progress: next })
      if (loadFailed) return
      try {
        await api().kidsSave(next)
      } catch {
        set({ notice: "That change couldn't be saved. It will show until the app closes; ask your grown-up to check the computer." })
      }
    }
    const pinOk = (pin: string) => api().kidsCheckPin(pin)

    return {
      loaded: false,
      progress: newProgress(),
      notice: null,
      page: { name: 'home' },

      load: async () => {
        if (get().loaded) return
        try {
          const { progress, notice } = await api().kidsLoad()
          set({ progress, notice, loaded: true })
        } catch {
          loadFailed = true
          set({ progress: newProgress(), notice: "Saved progress couldn't be opened, so the workshop started fresh. Nothing new will be saved until the app is restarted.", loaded: true })
        }
      },
      go: page => set({ page }),

      markLessonOpened: async id => {
        if (get().progress.openedLessons.includes(id)) return
        await update(p => ({ ...p, openedLessons: [...p.openedLessons, id] }))
      },
      passQuiz: async quizId => {
        if (get().progress.passedQuizzes[quizId]) return
        await update(p => ({ ...p, passedQuizzes: { ...p.passedQuizzes, [quizId]: today() } }))
      },
      confirmBuilt: async (projectId, pin) => {
        const proj = findProject(projectId)
        if (!proj || !projectUnlocked(proj, get().progress)) return false
        if (!(await pinOk(pin))) return false
        await update(p => ({ ...p, builtProjects: { ...p.builtProjects, [projectId]: { ...p.builtProjects[projectId], date: today() } } }))
        return true
      },
      setPhoto: async (projectId, photo) => {
        const built = get().progress.builtProjects[projectId]
        if (!built) return
        await update(p => ({ ...p, builtProjects: { ...p.builtProjects, [projectId]: { ...built, photo } } }))
      },
      setTier: async (tier, pin) => {
        if (!(await pinOk(pin))) return false
        await update(p => ({ ...p, tier }))
        return true
      },
      resetQuiz: async (quizId, pin) => {
        if (!(await pinOk(pin))) return false
        await update(p => {
          const { [quizId]: _gone, ...rest } = p.passedQuizzes
          return { ...p, passedQuizzes: rest }
        })
        return true
      },
      setNameAndPin: async (name, pin) => {
        await api().kidsSetPin(pin)
        await update(p => ({ ...p, childName: name.trim() }))
      }
    }
  })
}

export const kids = createKidsStore()
export function useKids<T>(selector: (s: KidsState) => T): T {
  return useStore(kids, selector)
}
