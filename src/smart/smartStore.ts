// Which Smart Helper dialog is open, and whether an online key is set (the key itself stays in the app's main part).
import { createStore, useStore } from 'zustand'

export type HelperKind = 'photoPlan' | 'woodId' | 'describe'
type State = {
  hasKey: boolean | null
  model: string
  open: HelperKind | 'settings' | null
  /** Build steps the photo helper suggested, shown beside the design it made. */
  steps: { name: string; steps: string[] } | null
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
