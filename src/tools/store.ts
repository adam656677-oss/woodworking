// The shop journal and inventory (tools, hardware, finishes), kept in the app's data folder. Lumber and sheets
// stay in the stock list the cut optimizer uses (src/optimize/stockStore.ts).
import { createStore, useStore } from 'zustand'
import { newId } from '../model/ids'

export type Cost = { what: string; amount: number }
/** `project` is the project's name when logged (or GENERAL); `file` its saved file, which keeps entries with it through renames. */
export type JournalEntry = { id: string; date: string; project: string; file?: string; notes: string; minutes: number; photos: string[]; costs: Cost[] }
/** Entries not about any one project. */
export const GENERAL = 'General shop'
export type ProjectRef = { name: string; file: string | null }
/** Whether an entry belongs to this project: by its file when it has one (so a rename keeps them), else by name. */
export const entryFor = (e: JournalEntry, p: ProjectRef) => (e.file ? e.file === p.file : e.project === p.name)
const cleanMinutes = (m: number) => Math.max(0, Math.round(Number.isFinite(m) ? m : 0))
export type ToolItem = { id: string; name: string; kind: string; notes?: string; tier?: 'beginner' | 'intermediate' | 'advanced' | 'adult' }
export type HardwareStock = { id: string; itemId: string; name: string; qty: number; min?: number }
export type FinishStock = { id: string; finishId?: string; product: string; amount: number; unit: 'oz' | 'qt' | 'gal' | 'can'; min?: number }
export type Inventory = { tools: ToolItem[]; hardware: HardwareStock[]; finishes: FinishStock[] }

const isObj = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v)
const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0
const str = (v: unknown) => typeof v === 'string'
const entryOk = (e: any): e is JournalEntry => isObj(e) && str(e.id) && str(e.date) && str(e.project) && str(e.notes) && num(e.minutes) &&
  (e.file === undefined || str(e.file)) && Array.isArray(e.photos) && e.photos.every((p: unknown) => str(p) && (p as string).startsWith('data:image/')) &&
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
  /** Files that were damaged on disk (their last good copy was loaded). */
  damaged: ('journal' | 'inventory')[]
  /** The last save that failed, in words. */
  saveError: string | null
  /** When the journal's timer was started (it keeps running while you look at other tabs). */
  timerStart: number | null
  journal: JournalEntry[]
  inventory: Inventory
  load(): Promise<void>
  addEntry(e: Omit<JournalEntry, 'id'>): string
  updateEntry(id: string, patch: Partial<Omit<JournalEntry, 'id'>>): void
  removeEntry(id: string): void
  setInventory(f: (i: Inventory) => Inventory): void
}

const LABEL = { journal: 'shop journal', inventory: 'inventory' } as const

export const tools = createStore<State>()((set, get) => {
  // Entries this version can't read stay in the file untouched.
  let unreadable: unknown[] = []
  const save = (name: 'journal' | 'inventory', data: unknown) => {
    Promise.resolve(window.aa?.saveData?.(name, data))
      .then(() => { if (get().saveError?.includes(LABEL[name])) set({ saveError: null }) })
      .catch(() => set({ saveError: `Couldn't save the ${LABEL[name]} — disk full or no permission.` }))
  }
  const saveJournal = (journal: JournalEntry[]) => { set({ journal }); save('journal', [...journal, ...unreadable]) }
  // The inventory saves once typing stops.
  let timer: ReturnType<typeof setTimeout> | null = null
  return {
    loaded: false,
    damaged: [],
    saveError: null,
    timerStart: null,
    journal: [],
    inventory: { tools: [], hardware: [], finishes: [] },
    load: async () => {
      const read = async (n: 'journal' | 'inventory') => (await window.aa?.loadData?.(n)) ?? { data: null, damaged: false }
      const [j, i] = await Promise.all([read('journal'), read('inventory')])
      const raw = Array.isArray(j.data) ? j.data : []
      unreadable = raw.filter(x => !entryOk(x))
      set({ journal: raw.filter(entryOk), inventory: cleanInventory(i.data), damaged: [...(j.damaged ? ['journal' as const] : []), ...(i.damaged ? ['inventory' as const] : [])], loaded: true })
    },
    addEntry: e => { const id = newId('r'); saveJournal([...get().journal, { ...e, minutes: cleanMinutes(e.minutes), id }]); return id },
    updateEntry: (id, patch) => saveJournal(get().journal.map(e => (e.id === id ? { ...e, ...patch, ...(patch.minutes !== undefined ? { minutes: cleanMinutes(patch.minutes) } : {}) } : e))),
    removeEntry: id => saveJournal(get().journal.filter(e => e.id !== id)),
    setInventory: f => {
      set({ inventory: f(get().inventory) })
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => { timer = null; save('inventory', get().inventory) }, 500)
    }
  }
})
export const useTools = <T,>(sel: (s: State) => T) => useStore(tools, sel)
export const newItemId = () => newId('r')

/** A project's journal totals: minutes (its entries plus Shop Mode's step timers) and money. */
export function journalTotals(entries: JournalEntry[], project: ProjectRef, shopMinutes = 0): { minutes: number; cost: number; entries: number } {
  const mine = entries.filter(e => entryFor(e, project))
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
      .catch(async e => {
        // iPhone photos (HEIC): the app decodes them.
        const small = await window.aa?.photoThumbnail?.(new Uint8Array(await file.arrayBuffer()), max)
        if (small) return small
        throw e
      })
    if (typeof img === 'string') return img
    const k = Math.min(1, max / Math.max(img.width, img.height))
    const c = document.createElement('canvas')
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k)
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
    return c.toDataURL('image/jpeg', 0.8)
  } finally {
    URL.revokeObjectURL(url)
  }
}
