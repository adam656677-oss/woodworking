// The shop's stock on hand: sheets, offcuts and boards (with defects), kept in the app's data folder.
import { createStore, useStore } from 'zustand'
import { newId } from '../model/ids'
import { stockAfterUse, type ShopStockItem } from './layout'

const isItem = (v: any): v is ShopStockItem => v && typeof v === 'object' && typeof v.id === 'string' && typeof v.woodId === 'string' &&
  ['sheet', 'offcut', 'board'].includes(v.kind) && typeof v.width === 'number' && v.width > 0 && typeof v.length === 'number' && v.length > 0 &&
  (v.defects === undefined || (Array.isArray(v.defects) && v.defects.every((d: any) => typeof d?.from === 'number' && typeof d?.to === 'number' && d.to > d.from)))

type State = {
  items: ShopStockItem[]
  loaded: boolean
  load(): Promise<void>
  add(item: Omit<ShopStockItem, 'id'>): void
  update(id: string, patch: Partial<Omit<ShopStockItem, 'id'>>): void
  remove(id: string): void
  /** After cutting: the pieces used go, and what's left of each becomes an offcut. */
  markUsed(used: { stockId: string; left?: { width: number; length: number } }[]): void
}

export const stock = createStore<State>()((set, get) => {
  const save = (items: ShopStockItem[]) => { set({ items }); void window.aa?.saveStock?.(items) }
  return {
    items: [],
    loaded: false,
    load: async () => {
      const raw = await window.aa?.loadStock?.()
      set({ items: Array.isArray(raw) ? raw.filter(isItem) : [], loaded: true })
    },
    // Never write before the list has been read: that would replace it.
    add: item => { if (get().loaded) save([...get().items, { ...item, id: newId('p') }]) },
    update: (id, patch) => save(get().items.map(i => (i.id === id ? { ...i, ...patch } : i))),
    remove: id => save(get().items.filter(i => i.id !== id)),
    markUsed: used => save(stockAfterUse(get().items, used, () => newId('p')))
  }
})
export const useStock = <T,>(sel: (s: State) => T) => useStore(stock, sel)
