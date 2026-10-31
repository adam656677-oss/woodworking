// The child's saved progress. Kept free of content and UI imports so the main process can use it.
import type { Tier } from './types'

export type ChildTier = Exclude<Tier, 'adult'>

export type Progress = {
  formatVersion: 1
  childName: string
  tier: ChildTier
  /** quiz id → date passed (YYYY-MM-DD) */
  passedQuizzes: Record<string, string>
  openedLessons: string[]
  /** project id → date the parent confirmed it was built, and its photo file name */
  builtProjects: Record<string, { date: string; photo?: string }>
  /** The parent turned the Games off. */
  gamesOff?: boolean
}

export function newProgress(): Progress {
  return { formatVersion: 1, childName: '', tier: 'intermediate', passedQuizzes: {}, openedLessons: [], builtProjects: {} }
}

const isObj = (v: unknown): v is Record<string, any> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isDate = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)

/** True when the value is a complete, sensible progress record (used on load and before every save). */
export function isProgress(v: unknown): v is Progress {
  if (!isObj(v) || v.formatVersion !== 1 || typeof v.childName !== 'string') return false
  if (!['beginner', 'intermediate', 'advanced'].includes(v.tier)) return false
  if (!isObj(v.passedQuizzes) || !Object.values(v.passedQuizzes).every(isDate)) return false
  if (!Array.isArray(v.openedLessons) || !v.openedLessons.every((x: unknown) => typeof x === 'string')) return false
  if (v.gamesOff !== undefined && typeof v.gamesOff !== 'boolean') return false
  if (!isObj(v.builtProjects)) return false
  return Object.values(v.builtProjects).every(b => isObj(b) && isDate(b.date) && (b.photo === undefined || typeof b.photo === 'string'))
}

/** Today as YYYY-MM-DD in local time. */
export function today(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`
}
