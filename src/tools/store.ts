// The shop journal and inventory (tools, hardware, finishes), kept in the app's data folder. Lumber and sheets
// stay in the stock list the cut optimizer uses (src/optimize/stockStore.ts).
import { createStore, useStore } from 'zustand'
import { newId } from '../model/ids'

export type Cost = { what: string; amount: number }
export type JournalEntry = { id: string; date: string; project: string; notes: string; minutes: number; photos: string[]; costs: Cost[] }
export type ToolItem = { id: string; name: string; kind: string; notes?: string; tier?: 'beginner' | 'intermediate' | 'advanced' | 'adult' }
export type HardwareStock = { id: string; itemId: string; name: string; qty: number; min?: number }
export type FinishStock = { id: string; finishId?: string; product: string; amount: number; unit: 'oz' | 'qt' | 'gal' | 'can'; min?: number }
export type Inventory = { tools: ToolItem[]; hardware: HardwareStock[]; finishes: FinishStock[] }

const isObj = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v)
const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0
const str = (v: unknown) => typeof v === 'string'
const entryOk = (e: any): e is JournalEntry => isObj(e) && str(e.id) && str(e.date) && str(e.project) && str(e.notes) && num(e.minutes) &&
  Array.isArray(e.photos) && e.photos.every((p: unknown) => str(p) && (p as string).startsWith('data:image/')) &&
  Array.isArray(e.costs) && e.costs.every((c: any) => isObj(c) && str(c.what) && num(c.amount))
export function cleanInventory(raw: unknown): Inventory {
  const r = isObj(raw) ? raw : {}
  const arr = (v: unknown) => (Array.isArray(v) ? v : [])
  return {
    tools: arr(r.tools).filter((t: any) => isObj(t) && str(t.id) && str(t.name) && str(t.kind)),
    hardware: arr(r.hardware).filter((h: any) => isObj(h) && str(h.id) && str(h.itemId) && str(h.name) && num(h.qty) && (h.min === undefined || num(h.min))),
    finishes: arr(r.finishes).filter((f: any) => isObj(f) && str(f.id) && str(f.product) && num(f.amount) && ['oz', 'qt', 'gal', 'can'].includes(f.unit) && (f.min === undefined || num(f.min)))
  }
}

type State = {
  loaded: boolean
  journal: JournalEntry[]
  inventory: Inventory
  load(): Promise<void>
  addEntry(e: Omit<JournalEntry, 'id'>): string
  updateEntry(id: string, patch: Partial<Omit<JournalEntry, 'id'>>): void
  removeEntry(id: string): void
  setInventory(f: (i: Inventory) => Inventory): void
}

export const tools = createStore<State>()((set, get) => {
  const saveJournal = (journal: JournalEntry[]) => { set({ journal }); void window.aa?.saveData?.('journal', journal) }
  return {
    loaded: false,
    journal: [],
    inventory: { tools: [], hardware: [], finishes: [] },
    load: async () => {
      const [j, i] = await Promise.all([window.aa?.loadData?.('journal'), window.aa?.loadData?.('inventory')])
      set({ journal: Array.isArray(j) ? j.filter(entryOk) : [], inventory: cleanInventory(i), loaded: true })
    },
    addEntry: e => { const id = newId('r'); saveJournal([...get().journal, { ...e, id }]); return id },
    updateEntry: (id, patch) => saveJournal(get().journal.map(e => (e.id === id ? { ...e, ...patch } : e))),
    removeEntry: id => saveJournal(get().journal.filter(e => e.id !== id)),
    setInventory: f => { const inventory = f(get().inventory); set({ inventory }); void window.aa?.saveData?.('inventory', inventory) }
  }
})
export const useTools = <T,>(sel: (s: State) => T) => useStore(tools, sel)
export const newItemId = () => newId('r')

/** A project's journal totals: minutes (its entries plus Shop Mode's step timers) and money. */
export function journalTotals(entries: JournalEntry[], project: string, shopMinutes = 0): { minutes: number; cost: number; entries: number } {
  const mine = entries.filter(e => e.project === project)
  return { minutes: mine.reduce((s, e) => s + e.minutes, 0) + shopMinutes, cost: Math.round(mine.reduce((s, e) => s + e.costs.reduce((a, c) => a + c.amount, 0), 0) * 100) / 100, entries: mine.length }
}

/** Items at or below their low-stock mark. */
export function lowStock(inv: Inventory): string[] {
  return [
    ...inv.hardware.filter(h => h.min !== undefined && h.qty <= h.min).map(h => `${h.name}: ${h.qty} left`),
    ...inv.finishes.filter(f => f.min !== undefined && f.amount <= f.min).map(f => `${f.product}: ${f.amount} ${f.unit} left`)
  ]
}

/** Shrinks a photo to a thumbnail-sized JPEG data URL (longest side `max` pixels). */
export async function thumbnail(file: Blob, max = 800): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("Couldn't read that picture")); i.src = url })
    const k = Math.min(1, max / Math.max(img.width, img.height))
    const c = document.createElement('canvas')
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k)
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
    return c.toDataURL('image/jpeg', 0.8)
  } finally {
    URL.revokeObjectURL(url)
  }
}
