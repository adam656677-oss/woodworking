// Which Shop Mode is open, if any (one at a time, over every screen).
import { createStore, useStore } from 'zustand'
import type { ShopProgress, ShopStep } from './steps'

export type ShopSession = {
  title: string
  steps: ShopStep[]
  progress: ShopProgress
  /** Kid-sized words and "Adult does this" marks. */
  kid: boolean
  /** Saves progress (ticks and minutes) where it belongs: the design, the plan or the kid's progress. */
  save(p: ShopProgress): void
  /** Draws a step's parts in 3D (designs only). */
  picture?: boolean
}

type State = { session: ShopSession | null; open(s: ShopSession): void; close(): void; setProgress(p: ShopProgress): void }

export const shop = createStore<State>()((set, get) => ({
  session: null,
  open: s => { set({ session: s }); void window.aa?.keepAwake?.(true) },
  close: () => { set({ session: null }); void window.aa?.keepAwake?.(false) },
  setProgress: p => {
    const s = get().session
    if (!s) return
    set({ session: { ...s, progress: p } })
    s.save(p)
  }
}))
export const useShop = <T,>(sel: (s: State) => T) => useStore(shop, sel)
