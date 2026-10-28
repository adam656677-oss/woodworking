// My Plans: the library, the plan being edited, and bringing plans in from PDFs, photos and web pages.
import { createStore, useStore } from 'zustand'
import { newId } from '../model/ids'
import { draftPlan } from './draft'
import { prepareForReading } from './image'
import { PlanImportError } from './importError'
import { TOOLS } from '../kids/content'
import { TIER_RANK } from '../kids/logic'
import { openPdf, type OpenPdf } from './pdf'
import { TOOL_NAMES } from './toolNames'
import { newPlan, type Plan, type TextLine } from './types'

export type PlanEntry = { folder: string; plan: Plan | null; error?: string; notice?: string }
export type PlansView = 'library' | 'edit' | 'import' | 'guide'

export type PlansState = {
  list: PlanEntry[]
  current: { folder: string; plan: Plan } | null
  view: PlansView
  kidsView: boolean
  notice: string | null
  /** Things the review should point out, like pages with nothing readable. */
  reviewNotes: string[]
  importing: { stage: string; page: number; pages: number } | null
  /** Where Back from the library goes (the Master Shop or the Kids' Workshop). */
  leave: () => void
  openLibrary(kidsView: boolean, leave: () => void): Promise<void>
  refresh(): Promise<void>
  open(folder: string): Promise<void>
  create(): Promise<void>
  update(fn: (p: Plan) => Plan): Promise<void>
  startImport(kind: 'pdf' | 'photos' | 'web', url?: string): Promise<void>
  cancelImport(): void
  acceptItem(id: string): Promise<void>
  acceptAll(): Promise<void>
  deleteItem(id: string): Promise<void>
  showGuide(): void
  back(): Promise<void>
}

/** Plans the viewer may see: the kids' side lists only kid-friendly plans that open. */
export function visiblePlans(list: PlanEntry[], kidsView: boolean): PlanEntry[] {
  return kidsView ? list.filter(e => e.plan?.kidFriendly) : list
}

const api = () => window.aa
const TOOL_RANK = Object.fromEntries(Object.values(TOOLS).map(t => [t.id, TIER_RANK[t.tier]]))
const ipcMessage = (e: unknown) => String((e as Error)?.message ?? e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
/** PDF text positions are in points (72 per inch); scanned pages are read from 150 dpi pictures. */
const POINTS_PER_PIXEL = 72 / 150
class Cancelled extends Error {}
const plainError = (e: unknown) =>
  e instanceof PlanImportError ? e.message : /\bweb\b/.test(String((e as Error)?.message)) ? new PlanImportError('web').message
    : /unreadable/.test(String((e as Error)?.message)) ? new PlanImportError('unreadable').message
      : `That plan couldn't be brought in: ${String((e as Error)?.message ?? e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')}`

export function createPlansStore() {
  return createStore<PlansState>()((set, get) => {
    let cancelled = false
    let saving: Promise<void> = Promise.resolve()

    const save = (folder: string, plan: Plan) => {
      // Saves run one after another so an older version never lands on top of a newer one.
      saving = saving.then(() => api().plansSave(folder, plan)).catch(() => set({ notice: "That change couldn't be saved — check the Plans folder isn't read-only." }))
      return saving
    }
    const setPlan = async (fn: (p: Plan) => Plan) => {
      const cur = get().current
      if (!cur) return
      const plan = fn(cur.plan)
      set({ current: { ...cur, plan } })
      await save(cur.folder, plan)
    }
    const checkpoint = () => {
      if (cancelled) throw new Cancelled()
    }

    return {
      list: [],
      current: null,
      view: 'library',
      kidsView: false,
      notice: null,
      reviewNotes: [],
      importing: null,
      leave: () => {},

      openLibrary: async (kidsView, leave) => {
        set({ kidsView, leave, view: 'library', current: null, notice: null })
        await get().refresh()
      },
      refresh: async () => set({ list: await api().plansList() }),
      open: async folder => {
        try {
          const { plan, notice } = await api().plansLoad(folder)
          set({ current: { folder, plan }, view: get().kidsView ? 'guide' : 'edit', notice })
        } catch (e) {
          set({ notice: String((e as Error).message).replace(/^Error invoking remote method '[^']+': (Error: )?/, '') })
        }
      },
      create: async () => {
        const plan = newPlan('New plan', newId('p'))
        try {
          const folder = await api().plansCreate(plan)
          set({ current: { folder, plan }, view: 'edit', reviewNotes: [], notice: null })
        } catch (e) {
          set({ notice: `Couldn't create the plan — check that the Plans folder in Documents can be written to. (${ipcMessage(e)})` })
        }
      },
      update: fn => setPlan(fn),

      startImport: async (kind, url) => {
        set({ notice: null, reviewNotes: [] })
        let sources: { name: string; bytes: Uint8Array }[] = []
        let sourceName = url ?? ''
        if (kind === 'web') {
          if (!url || !/^https?:\/\//i.test(url.trim())) {
            set({ notice: 'Paste a full web address starting with http:// or https://' })
            return
          }
          sourceName = url.trim()
        } else {
          sources = await api().plansPickImport(kind)
          if (sources.length === 0) return
          sourceName = sources.map(s => s.name).join(', ')
        }
        const name = kind === 'web' ? new URL(sourceName).hostname.replace(/^www\./, '') : sources[0].name.replace(/\.[^.]+$/, '')
        cancelled = false
        const start = newPlan(name, newId('p'))
        let folder: string
        try {
          folder = await api().plansCreate(start)
        } catch (e) {
          set({ notice: `Couldn't create the plan — check that the Plans folder in Documents can be written to. (${ipcMessage(e)})` })
          return
        }
        set({ current: { folder, plan: start }, importing: { stage: 'Opening', page: 0, pages: 0 } })
        let doc: OpenPdf | null = null
        try {
          const lines: TextLine[] = []
          let pages = 0
          let pdf: Uint8Array | null = null
          if (kind === 'web') {
            set({ importing: { stage: 'Opening the web page', page: 0, pages: 0 } })
            pdf = await api().plansCapture(sourceName)
          } else if (kind === 'pdf') pdf = sources[0].bytes
          checkpoint()
          if (pdf) {
            // One open PDF serves both its text and its page pictures; it is closed in `finally`.
            doc = await openPdf(pdf)
            const r = await doc.textLines()
            lines.push(...r.lines)
            pages = doc.pageCount
            for (let n = 1; n <= pages; n++) {
              checkpoint()
              set({ importing: { stage: r.scanPages.includes(n) ? 'Reading a scanned page' : 'Saving pages', page: n, pages } })
              const { png } = await doc.render(n)
              await api().plansSavePage(folder, n, png)
              checkpoint()
              if (r.scanPages.includes(n)) {
                const read = await api().plansOcr(png, n)
                lines.push(...read.map(l => ({
                  ...l,
                  box: l.box.map(v => v * POINTS_PER_PIXEL) as TextLine['box'],
                  size: l.size === undefined ? undefined : l.size * POINTS_PER_PIXEL
                })))
              }
            }
          } else {
            pages = sources.length
            for (let i = 0; i < sources.length; i++) {
              checkpoint()
              set({ importing: { stage: 'Reading photos', page: i + 1, pages } })
              const png = await prepareForReading(sources[i].bytes)
              await api().plansSavePage(folder, i + 1, png)
              checkpoint()
              lines.push(...(await api().plansOcr(png, i + 1)))
            }
          }
          checkpoint()
          const d = draftPlan(lines, TOOL_NAMES, TOOL_RANK)
          const plan: Plan = {
            ...d.plan,
            id: start.id,
            name: d.plan.name === 'Imported plan' ? name : d.plan.name,
            source: kind === 'web' ? { kind, name: sourceName, url: sourceName, pages } : { kind, name: sourceName, pages },
            picture: pages ? { kind: 'page', ref: 'pages/page-001.png' } : undefined
          }
          if (!plan.picture) delete plan.picture
          const empty = Array.from({ length: pages }, (_, i) => i + 1).filter(n => !lines.some(l => l.page === n))
          const reviewNotes = [...empty.map(n => `Nothing readable on page ${n} — type the steps yourself.`), ...d.notes]
          await save(folder, plan)
          set({ current: { folder, plan }, view: 'import', importing: null, reviewNotes })
        } catch (e) {
          await api().plansDiscard(folder).catch(() => undefined)
          set({ current: null, importing: null, view: 'library', notice: e instanceof Cancelled ? null : plainError(e) })
          await get().refresh().catch(() => undefined)
        } finally {
          await doc?.destroy().catch(() => undefined)
        }
      },
      cancelImport: () => {
        cancelled = true
      },

      acceptItem: id => setPlan(p => ({ ...p, unchecked: p.unchecked.filter(x => x !== id) })),
      acceptAll: () => setPlan(p => ({ ...p, unchecked: [] })),
      deleteItem: id =>
        setPlan(p => ({
          ...p,
          steps: p.steps.filter(s => s.id !== id),
          cutRows: p.cutRows.filter(r => r.id !== id),
          unchecked: p.unchecked.filter(x => x !== id),
          review: p.review?.filter(r => r.itemId !== id)
        })),

      showGuide: () => set({ view: 'guide' }),
      back: async () => {
        const v = get().view
        if (v === 'guide' && !get().kidsView) return set({ view: 'edit' })
        if (v === 'library') return get().leave()
        const cur = get().current
        await saving
        // The folder follows the plan's name (so it reads right in File Explorer).
        if (cur && !get().kidsView && cur.plan.name.trim()) {
          try {
            await api().plansRename(cur.folder, cur.plan.name)
          } catch {
            // A folder that can't be renamed (open in Explorer) keeps its old name; nothing is lost.
          }
        }
        set({ view: 'library', current: null })
        await get().refresh().catch(() => undefined)
      }
    }
  })
}

export const plans = createPlansStore()
export function usePlans<T>(selector: (s: PlansState) => T): T {
  return useStore(plans, selector)
}
