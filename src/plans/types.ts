// A woodworking plan: written in the app or brought in from a PDF, photos or a web page.

export type PlanStep = { id: string; text: string; tool?: string; photo?: string; showDesign?: boolean; tip?: string }
export type CutRow = { id: string; qty: number; part: string; thickness: number; width: number; length: number; wood: string; notes: string }
export type Material = { text: string; amount: string }
export type PlanSource = { kind: 'pdf' | 'photos' | 'web'; name: string; url?: string; pages: number }
/** Where a drafted item came from: page number and box (x, y, w, h) on that page. */
export type ReviewRef = { itemId: string; page: number; box: [number, number, number, number] }

export type Plan = {
  formatVersion: 1
  id: string
  name: string
  kidFriendly: boolean
  stars: 1 | 2 | 3
  minutes: number
  description: string
  picture?: { kind: 'photo' | 'page' | 'design'; ref: string }
  tools: string[]
  materials: Material[]
  notes: string
  steps: PlanStep[]
  /** Used when no design is attached. */
  cutRows: CutRow[]
  design?: 'design.aaw'
  source?: PlanSource
  review?: ReviewRef[]
  /** Drafted items not yet accepted. */
  unchecked: string[]
  /** Why a drafted item needs a closer look (item id → reason). */
  checkNotes?: Record<string, string>
  /** Shop Mode ticks and minutes, by step id. */
  progress?: { done: string[]; minutes: Record<string, number> }
}

/** One line of text from a page, with where it sits. `size` is the text height; `uncertain` lists words the reader doubted. */
export type TextLine = { text: string; page: number; box: [number, number, number, number]; size?: number; uncertain?: string[] }

export function newPlan(name: string, id: string): Plan {
  return {
    formatVersion: 1, id, name, kidFriendly: false, stars: 1, minutes: 60, description: '',
    tools: [], materials: [], notes: '', steps: [], cutRows: [], unchecked: []
  }
}

const isObj = (v: unknown): v is Record<string, any> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isNum = (v: unknown) => typeof v === 'number' && Number.isFinite(v)
const isStr = (v: unknown) => typeof v === 'string'

/** True when the value is a complete plan (checked on load and before every save). */
export function isPlan(v: unknown): v is Plan {
  if (!isObj(v) || v.formatVersion !== 1 || !isStr(v.id) || !isStr(v.name) || typeof v.kidFriendly !== 'boolean') return false
  if (![1, 2, 3].includes(v.stars) || !isNum(v.minutes) || !isStr(v.description) || !isStr(v.notes)) return false
  if (!Array.isArray(v.tools) || !v.tools.every(isStr)) return false
  if (!Array.isArray(v.materials) || !v.materials.every((m: any) => isObj(m) && isStr(m.text) && isStr(m.amount))) return false
  if (!Array.isArray(v.steps) || !v.steps.every((s: any) => isObj(s) && isStr(s.id) && isStr(s.text))) return false
  if (!Array.isArray(v.cutRows) || !v.cutRows.every((r: any) => isObj(r) && isStr(r.id) && isNum(r.qty) && isStr(r.part) && isNum(r.thickness) && isNum(r.width) && isNum(r.length) && isStr(r.wood) && isStr(r.notes))) return false
  if (!(Array.isArray(v.unchecked) && v.unchecked.every(isStr))) return false
  // Shop Mode progress that's damaged is dropped (the plan itself is fine).
  const pr = v.progress
  if (pr !== undefined && !(isObj(pr) && Array.isArray(pr.done) && pr.done.every(isStr) && isObj(pr.minutes) && Object.values(pr.minutes).every(m => isNum(m) && (m as number) >= 0))) delete v.progress
  return true
}
