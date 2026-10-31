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
  const { files } = await collectBackup(ud, docs)
  expect(files.map(f => `${f.area}:${f.path}`).sort()).toEqual(['docs:Bookshelf.aaw', 'docs:Plans/Shelf/photos/a.jpg', 'docs:Plans/Shelf/plan.json', 'user:journal.json', 'user:kids-photos/birdhouse.jpg', 'user:kids-progress.json'])
})

test('back up and restore onto an empty computer: everything comes back the same', async () => {
  const file = join(out, 'b.aabackup')
  await writeBackup(file, (await collectBackup(ud, docs)).files)
  const ud2 = await mkdtemp(join(tmpdir(), 'aa-ud2-')), docs2 = await mkdtemp(join(tmpdir(), 'aa-docs2-'))
  const r = await restoreBackup(file, ud2, docs2)
  expect(r.files).toBe(6)
  expect(await readFile(join(ud2, 'journal.json'), 'utf8')).toBe('[{"id":"1"}]')
  expect([...await readFile(join(ud2, 'kids-photos', 'birdhouse.jpg'))]).toEqual([1, 2, 3])
  expect(await readFile(join(docs2, 'Plans', 'Shelf', 'plan.json'), 'utf8')).toBe('{}')
})

test('restoring over existing files keeps the old ones aside first', async () => {
  const file = join(out, 'b.aabackup')
  await writeBackup(file, (await collectBackup(ud, docs)).files)
  await writeFile(join(ud, 'journal.json'), '[{"id":"newer"}]')
  await writeFile(join(docs, 'Bookshelf.aaw'), '{"name":"Changed"}')
  const r = await restoreBackup(file, ud, docs)
  expect(await readFile(join(ud, 'journal.json'), 'utf8')).toBe('[{"id":"1"}]')
  expect(await readFile(join(r.keptUser!, 'journal.json'), 'utf8')).toBe('[{"id":"newer"}]')
  expect(await readFile(join(r.keptDocs!, 'Bookshelf.aaw'), 'utf8')).toBe('{"name":"Changed"}')
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

test('odd files Windows leaves about are skipped, so every backup can be restored', async () => {
  await writeFile(join(ud, 'kids-photos', 'Thumbs.db'), 'x')
  await writeFile(join(ud, 'kids-photos', 'Birdhouse.JPG'), 'x')
  await writeFile(join(docs, 'desktop.ini'), 'x')
  const { files, skipped } = await collectBackup(ud, docs)
  expect(files.map(f => f.path)).not.toContain('desktop.ini')
  expect(skipped).toContain('kids-photos/Birdhouse.JPG')
  const file = join(out, 'b.aabackup')
  await writeBackup(file, files)
  await expect(readBackup(file)).resolves.toBeTruthy()
})

test('a restore that can\'t get ready changes nothing', async () => {
  const file = join(out, 'b.aabackup')
  await writeFile(file, gzipSync(JSON.stringify({ format: 'aa-backup', version: 1, created: 'x', files: [
    { area: 'docs', path: 'a.aaw', data: Buffer.from('A-BACKUP').toString('base64') },
    { area: 'docs', path: 'blocker/x.aaw', data: Buffer.from('X').toString('base64') },
    { area: 'docs', path: 'z.aaw', data: Buffer.from('Z-BACKUP').toString('base64') }] })))
  await writeFile(join(docs, 'a.aaw'), 'A-NOW')
  await writeFile(join(docs, 'blocker'), 'a file where a folder should be')
  await expect(restoreBackup(file, ud, docs)).rejects.toThrow(/Nothing was changed/)
  expect(await readFile(join(docs, 'a.aaw'), 'utf8')).toBe('A-NOW')
  expect((await readdir(docs)).filter(n => n.endsWith('.restore-tmp'))).toEqual([])
})

test('a file that can\'t be read where the restore would write is not replaced', async () => {
  const file = join(out, 'b.aabackup')
  await writeBackup(file, [{ area: 'docs', path: 'busy.aaw', data: Buffer.from('OLD').toString('base64') }])
  await mkdir(join(docs, 'busy.aaw'))
  await expect(restoreBackup(file, ud, docs)).rejects.toThrow(/Nothing was changed/)
})

test('names Windows can\'t have, and two entries for one file, are refused', async () => {
  for (const bad of ['CON', 'aux.aaw', 'x/NUL.txt', 'a.aaw:stream', 'trail.', 'q?.aaw', 'a<b>.aaw']) {
    const f = join(out, 'w.aabackup')
    await writeFile(f, gzipSync(JSON.stringify({ format: 'aa-backup', version: 1, created: 'x', files: [{ area: 'docs', path: bad, data: '' }] })))
    await expect(readBackup(f), bad).rejects.toThrow(/backup/i)
  }
  const twin = join(out, 't.aabackup')
  await writeFile(twin, gzipSync(JSON.stringify({ format: 'aa-backup', version: 1, created: 'x', files: [{ area: 'docs', path: 'A.aaw', data: '' }, { area: 'docs', path: 'a.aaw', data: '' }] })))
  await expect(readBackup(twin)).rejects.toThrow(/backup/i)
})

test('an autosave of a restored project is set aside, so it can\'t undo the restore', async () => {
  const file = join(out, 'b.aabackup')
  await writeBackup(file, (await collectBackup(ud, docs)).files)
  await writeFile(join(docs, 'Bookshelf.aaw'), '{"name":"Changed"}')
  await writeFile(join(docs, 'Bookshelf.aaw.autosave'), '{"name":"Autosaved"}')
  const r = await restoreBackup(file, ud, docs)
  expect(await readdir(docs)).not.toContain('Bookshelf.aaw.autosave')
  expect(await readFile(join(r.keptDocs!, 'Bookshelf.aaw.autosave'), 'utf8')).toBe('{"name":"Autosaved"}')
})
