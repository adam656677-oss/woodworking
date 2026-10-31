// Project packages: a design with its shop journal (notes, time, costs, photos) to hand to someone else.
import { deserialize, serialize } from '../model/fileFormat'
import type { Project } from '../model/types'
import { entryFor, type JournalEntry } from '../tools/store'

export type ProjectPackage = { format: 'aa-package'; version: 1; name: string; project: string; journal: JournalEntry[]; from?: string; note?: string }

export function makePackage(p: Project, file: string | null, journal: JournalEntry[], opts: { from?: string; note?: string; withJournal?: boolean } = {}): ProjectPackage {
  const mine = opts.withJournal === false ? [] : journal.filter(e => entryFor(e, { name: p.name, file })).map(({ file: _f, ...e }) => e)
  return { format: 'aa-package', version: 1, name: p.name, project: serialize(p), journal: mine, ...(opts.from?.trim() ? { from: opts.from.trim() } : {}), ...(opts.note?.trim() ? { note: opts.note.trim() } : {}) }
}

/** What's inside a package, checked: the design (opened like a file) and journal entries renamed to fit in. */
export function openPackage(pkg: ProjectPackage, newId: () => string): { project: Project; text: string; journal: JournalEntry[] } {
  const project = deserialize(pkg.project)
  const ok = (e: any): e is JournalEntry => e && typeof e.date === 'string' && typeof e.notes === 'string' && typeof e.minutes === 'number' && e.minutes >= 0 &&
    Array.isArray(e.photos) && e.photos.every((x: unknown) => typeof x === 'string' && x.startsWith('data:image/')) && Array.isArray(e.costs)
  const journal = pkg.journal.filter(ok).map(e => ({ ...e, id: newId(), project: project.name, file: undefined, notes: pkg.from ? `${e.notes}${e.notes ? ' ' : ''}(from ${pkg.from})` : e.notes }))
  return { project, text: pkg.project, journal: journal.map(({ file: _f, ...e }) => e) }
}
