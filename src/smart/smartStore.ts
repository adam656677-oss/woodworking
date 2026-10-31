// Which Smart Helper dialog is open, and whether an online key is set (the key itself stays in the app's main part).
import { createStore, useStore } from 'zustand'

export type HelperKind = 'photoPlan' | 'woodId' | 'describe'
export type HelperNote = {
  kind: 'plan' | 'trace'
  name: string
  steps: string[]
  /** A warning about the design (parts that overlap after snapping to stock). */
  note?: string
  /** The design it belongs to (studio projectKey); it's put away when another design opens. */
  projectKey: number
}
type State = {
  hasKey: boolean | null
  model: string
  open: HelperKind | 'settings' | null
  /** Build steps a helper suggested (or how to trace a photo), shown beside the design they belong to. */
  steps: HelperNote | null
  refresh(): Promise<void>
  set(p: Partial<Omit<State, 'set' | 'refresh'>>): void
}
export const smart = createStore<State>((set) => ({
  hasKey: null, model: '', open: null, steps: null,
  refresh: async () => { const s = await window.aa.smartStatus?.().catch(() => null); if (s) set({ hasKey: s.hasKey, model: s.model }) },
  set: p => set(p)
}))
export const useSmart = <T,>(sel: (s: State) => T) => useStore(smart, sel)
export const cleanError = (e: unknown) => (e as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
