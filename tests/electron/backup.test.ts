import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { collectBackup, readBackup, restoreBackup, writeBackup, readPackage, writePackage } from '../../electron/backup'

let ud: string, docs: string, out: string
beforeEach(async () => {
  ud = await mkdtemp(join(tmpdir(), 'aa-ud-'))
  docs = await mkdtemp(join(tmpdir(), 'aa-docs-'))
  out = await mkdtemp(join(tmpdir(), 'aa-out-'))
  await writeFile(join(ud, 'journal.json'), '[{"id":"1"}]')
  await writeFile(join(ud, 'kids-progress.json'), '{"childName":"Sam"}')
  await writeFile(join(ud, 'Preferences'), 'electron stuff')
  await mkdir(join(ud, 'kids-photos'))
  await writeFile(join(ud, 'kids-photos', 'birdhouse.jpg'), Buffer.from([1, 2, 3]))
  await mkdir(join(docs, 'Plans', 'Shelf', 'photos'), { recursive: true })
  await writeFile(join(docs, 'Bookshelf.aaw'), '{"name":"Bookshelf"}')
  await writeFile(join(docs, 'Bookshelf.aaw.bak'), 'old')
  await writeFile(join(docs, 'Plans', 'Shelf', 'plan.json'), '{}')
  await writeFile(join(docs, 'Plans', 'Shelf', 'photos', 'a.jpg'), Buffer.from([9, 9]))
})

test('a backup holds the app\'s own files and the projects folder, nothing else', async () => {
  const files = await collectBackup(ud, docs)
  expect(files.map(f => `${f.area}:${f.path}`).sort()).toEqual(['docs:Bookshelf.aaw', 'docs:Plans/Shelf/photos/a.jpg', 'docs:Plans/Shelf/plan.json', 'user:journal.json', 'user:kids-photos/birdhouse.jpg', 'user:kids-progress.json'])
})

test('back up and restore onto an empty computer: everything comes back the same', async () => {
  const file = join(out, 'b.aabackup')
  await writeBackup(file, await collectBackup(ud, docs))
  const ud2 = await mkdtemp(join(tmpdir(), 'aa-ud2-')), docs2 = await mkdtemp(join(tmpdir(), 'aa-docs2-'))
  const r = await restoreBackup(file, ud2, docs2)
  expect(r.files).toBe(6)
  expect(await readFile(join(ud2, 'journal.json'), 'utf8')).toBe('[{"id":"1"}]')
  expect([...await readFile(join(ud2, 'kids-photos', 'birdhouse.jpg'))]).toEqual([1, 2, 3])
  expect(await readFile(join(docs2, 'Plans', 'Shelf', 'plan.json'), 'utf8')).toBe('{}')
})

test('restoring over existing files keeps the old ones aside first', async () => {
  const file = join(out, 'b.aabackup')
  await writeBackup(file, await collectBackup(ud, docs))
  await writeFile(join(ud, 'journal.json'), '[{"id":"newer"}]')
  await writeFile(join(docs, 'Bookshelf.aaw'), '{"name":"Changed"}')
  const r = await restoreBackup(file, ud, docs)
  expect(await readFile(join(ud, 'journal.json'), 'utf8')).toBe('[{"id":"1"}]')
  expect(await readFile(join(ud, r.keptUser!, 'journal.json'), 'utf8')).toBe('[{"id":"newer"}]')
  expect(await readFile(join(docs, r.keptDocs!, 'Bookshelf.aaw'), 'utf8')).toBe('{"name":"Changed"}')
})

test('a damaged or doctored backup is refused before anything is touched', async () => {
  const bad = join(out, 'bad.aabackup')
  await writeFile(bad, 'not gzip')
  await expect(readBackup(bad)).rejects.toThrow(/backup/i)
  const evil = join(out, 'evil.aabackup')
  await writeFile(evil, gzipSync(JSON.stringify({ format: 'aa-backup', version: 1, created: 'x', files: [{ area: 'user', path: '../../etc/x', data: '' }] })))
  await expect(restoreBackup(evil, ud, docs)).rejects.toThrow(/backup/i)
  const abs = join(out, 'abs.aabackup')
  await writeFile(abs, gzipSync(JSON.stringify({ format: 'aa-backup', version: 1, created: 'x', files: [{ area: 'user', path: 'C:/Windows/x', data: '' }] })))
  await expect(readBackup(abs)).rejects.toThrow(/backup/i)
  expect(await readdir(ud)).not.toContain('etc')
})

test('a project package round-trips; other files are refused', async () => {
  const f = join(out, 'p.aapkg')
  const pkg = { format: 'aa-package' as const, version: 1 as const, name: 'Shelf', project: '{"x":1}', journal: [] }
  await writePackage(f, pkg)
  expect(await readPackage(f)).toEqual(pkg)
  await writeFile(f, gzipSync('{"format":"other"}'))
  await expect(readPackage(f)).rejects.toThrow(/package/i)
})
