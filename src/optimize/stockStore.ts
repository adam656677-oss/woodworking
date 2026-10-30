// The shop's stock on hand: sheets, offcuts and boards (with defects), kept in the app's data folder.
import { createStore, useStore } from 'zustand'
import { newId } from '../model/ids'
import type { ShopStockItem } from './layout'

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
  markUsed(used: { id: string; left?: { width: number; length: number } }[]): void
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
    add: item => save([...get().items, { ...item, id: newId('p') }]),
    update: (id, patch) => save(get().items.map(i => (i.id === id ? { ...i, ...patch } : i))),
    remove: id => save(get().items.filter(i => i.id !== id)),
    markUsed: used => {
      const ids = new Set(used.map(u => u.id))
      const left = used.filter(u => u.left && u.left.width >= 1 && u.left.length >= 1)
      const items = get().items.flatMap(i => {
        if (!ids.has(i.id)) return [i]
        const l = left.find(u => u.id === i.id)?.left
        return l ? [{ ...i, id: newId('p'), kind: 'offcut' as const, width: l.width, length: l.length, defects: undefined }] : []
      })
      save(items)
    }
  }
})
export const useStock = <T,>(sel: (s: State) => T) => useStore(stock, sel)
