import { makePackage, openPackage } from '../../src/family/package'
import { emptyProject } from '../../src/model/woods'
import { applyTemplate } from '../../src/templates'
import type { JournalEntry } from '../../src/tools/store'

const e = (o: Partial<JournalEntry>): JournalEntry => ({ id: Math.random().toString(), date: '2026-10-31', project: 'Bookshelf', notes: 'Glued up', minutes: 30, photos: ['data:image/jpeg;base64,AA'], costs: [{ what: 'Glue', amount: 6 }], ...o })

test('a package carries the design and only its own journal entries, and opens back the same', () => {
  const { template: _t, ...p } = applyTemplate(emptyProject('Bookshelf'), 'bookshelf', {})
  const journal = [e({}), e({ project: 'Other' }), e({ file: 'C:/x/Bookshelf.aaw', project: 'Old name' })]
  const pkg = makePackage(p, 'C:/x/Bookshelf.aaw', journal, { from: 'Adam', note: 'Try the shelf pins' })
  expect(pkg.journal).toHaveLength(2)
  expect(pkg.journal.every(x => !('file' in x))).toBe(true)
  let n = 0
  const r = openPackage(JSON.parse(JSON.stringify(pkg)), () => `n${++n}`)
  expect(r.project.boards.length).toBe(p.boards.length)
  expect(r.journal.map(x => x.id)).toEqual(['n1', 'n2'])
  expect(r.journal[0].notes).toBe('Glued up (from Adam)')
  expect(r.journal.every(x => x.project === 'Bookshelf')).toBe(true)
  expect(makePackage(p, null, journal, { withJournal: false }).journal).toEqual([])
})

test('bad journal entries in a package are left out; a broken design is refused', () => {
  const { template: _t, ...p } = applyTemplate(emptyProject('Bookshelf'), 'bookshelf', {})
  const pkg = makePackage(p, null, [])
  const bad = { ...pkg, journal: [{ date: 'x', notes: 'n', minutes: -5, photos: [], costs: [] }, { date: 'x', notes: 'n', minutes: 5, photos: ['javascript:alert(1)'], costs: [] }] as never[] }
  expect(openPackage(bad, () => 'i').journal).toEqual([])
  expect(() => openPackage({ ...pkg, project: '{"formatVersion":99}' }, () => 'i')).toThrow()
})

test('package journal entries must pass the journal\'s own check (costs too)', () => {
  const { template: _t, ...p } = applyTemplate(emptyProject('Bookshelf'), 'bookshelf', {})
  const pkg = makePackage(p, null, [])
  const bad = { ...pkg, journal: [e({ costs: [{ what: 7, amount: 'lots' }, null] as never }), e({})] }
  expect(openPackage(bad, () => 'i').journal).toHaveLength(1)
})
