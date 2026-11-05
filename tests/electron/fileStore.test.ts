import { mkdtemp, readFile, utimes, writeFile } from 'node:fs/promises'
import * as realFs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { autosavePath, defaultFolder, deleteAutosave, load, loadJson, safeSave, writeAutosave } from '../../electron/fileStore'

let dir: string
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'aa-'))
})

test('safeSave keeps the previous version as .bak', async () => {
  const p = join(dir, 'Box.aaw')
  await safeSave(p, 'first')
  await safeSave(p, 'second')
  expect(await readFile(p, 'utf8')).toBe('second')
  expect(await readFile(p + '.bak', 'utf8')).toBe('first')
})

test('a failed write (disk full) leaves the last saved file intact', async () => {
  const p = join(dir, 'Box.aaw')
  await safeSave(p, 'good')
  const failing = {
    ...realFs,
    writeFile: async () => {
      throw Object.assign(new Error('no space'), { code: 'ENOSPC' })
    }
  }
  await expect(safeSave(p, 'new', failing as any)).rejects.toThrow("Couldn't save — disk full or no permission. Your last saved version is safe.")
  expect(await readFile(p, 'utf8')).toBe('good')
})

test('load reports when the autosave is newer than the file', async () => {
  const p = join(dir, 'Box.aaw')
  await safeSave(p, 'saved')
  const a = autosavePath(p, dir)
  expect(a).toBe(p + '.autosave')
  await writeFile(a, 'autosaved')
  const old = new Date(Date.now() - 60_000)
  await utimes(p, old, old)
  const r = await load(p)
  expect(r).toMatchObject({ text: 'saved', autosaveNewer: true, autosavePath: a, backupPath: p + '.bak' })
  await utimes(a, new Date(Date.now() - 120_000), new Date(Date.now() - 120_000))
  expect((await load(p)).autosaveNewer).toBe(false)
})

test('untitled projects autosave in the default folder', () => {
  expect(defaultFolder('/docs')).toBe(join('/docs', 'A&A Woodworking'))
  expect(autosavePath(null, '/docs')).toBe(join('/docs', 'A&A Woodworking', 'Untitled.aaw.autosave'))
})

test('a rename briefly blocked by OneDrive or antivirus (EBUSY/EPERM) is retried', async () => {
  const p = join(dir, 'Box.aaw')
  let tries = 0
  const flaky = {
    ...realFs,
    rename: async (a: string, b: string) => {
      tries++
      if (tries < 3) throw Object.assign(new Error('busy'), { code: tries === 1 ? 'EBUSY' : 'EPERM' })
      return realFs.rename(a, b)
    }
  }
  await safeSave(p, 'saved', flaky as any, 1)
  expect(await readFile(p, 'utf8')).toBe('saved')
  expect(tries).toBe(3)
})

test('a save that fails for good removes its .tmp file', async () => {
  const p = join(dir, 'Box.aaw')
  const stuck = { ...realFs, rename: async () => { throw Object.assign(new Error('busy'), { code: 'EBUSY' }) } }
  await expect(safeSave(p, 'x', stuck as any, 1)).rejects.toThrow("Couldn't save")
  await expect(realFs.stat(p + '.tmp')).rejects.toThrow()
})

test('deleteAutosave removes the side file and ignores one that is already gone', async () => {
  const p = join(dir, 'Box.aaw')
  await writeFile(p + '.autosave', 'x')
  await deleteAutosave(p + '.autosave')
  await expect(realFs.stat(p + '.autosave')).rejects.toThrow()
  await deleteAutosave(p + '.autosave')
})

test('saves of the same file at the same moment take turns: the file ends whole, as the last one', async () => {
  const p = join(dir, 'journal.json')
  const texts = Array.from({ length: 8 }, (_, i) => JSON.stringify({ n: i, pad: 'x'.repeat((8 - i) * 300) }))
  await Promise.all(texts.map(t => safeSave(p, t)))
  expect(JSON.parse(await readFile(p, 'utf8')).n).toBe(7)
})

test('loadJson falls back to the .bak when the file is damaged, and says so', async () => {
  const p = join(dir, 'journal.json')
  await safeSave(p, '[1]')
  await safeSave(p, '[1,2]')
  await writeFile(p, '[1,2')
  expect(await loadJson(p)).toEqual({ data: [1], damaged: true })
  expect(await loadJson(join(dir, 'none.json'))).toEqual({ data: null, damaged: false })
  expect(await loadJson(p.replace('journal', 'none'))).toEqual({ data: null, damaged: false })
})

test('safeSave flushes the temp file to disk before swapping it in', async () => {
  const p = join(dir, 'Flush.aaw')
  const events: string[] = []
  const spy = {
    ...realFs,
    open: async (...a: Parameters<typeof realFs.open>) => {
      const fh = await realFs.open(...a)
      const sync = fh.sync.bind(fh)
      fh.sync = async () => { events.push('sync'); return sync() }
      return fh
    },
    rename: async (a: string, b: string) => { events.push('rename'); return realFs.rename(a, b) }
  }
  await safeSave(p, 'data', spy as any)
  expect(events).toEqual(['sync', 'rename'])
})

test('a save that fails keeps the real cause for the error log', async () => {
  const p = join(dir, 'Cause.aaw')
  const failing = { ...realFs, writeFile: async () => { throw Object.assign(new Error('no space'), { code: 'ENOSPC' }) } }
  const err = await safeSave(p, 'x', failing as any).catch(e => e)
  expect(err.message).toContain("Couldn't save")
  expect((err.cause as NodeJS.ErrnoException).code).toBe('ENOSPC')
})

test('a rename blocked by antivirus (EPERM) is retried and the save succeeds', async () => {
  const p = join(dir, 'Locked.aaw')
  let blocked = 2
  const flaky = {
    ...realFs,
    rename: async (a: string, b: string) => {
      if (blocked-- > 0) throw Object.assign(new Error('locked'), { code: 'EPERM' })
      return realFs.rename(a, b)
    }
  }
  await safeSave(p, 'ok', flaky as any, 1)
  expect(await readFile(p, 'utf8')).toBe('ok')
})

test('a rename that keeps failing leaves the previous file and no temp file behind', async () => {
  const p = join(dir, 'Stuck.aaw')
  await safeSave(p, 'before')
  const stuck = { ...realFs, rename: async () => { throw Object.assign(new Error('busy'), { code: 'EBUSY' }) } }
  await expect(safeSave(p, 'after', stuck as any, 1)).rejects.toThrow('Your last saved version is safe')
  expect(await readFile(p, 'utf8')).toBe('before')
  await expect(readFile(`${p}.tmp`, 'utf8')).rejects.toThrow()
})

test('the autosave is written through a temp file, so a crash mid-write never leaves half a file', async () => {
  const a = join(dir, 'Box.aaw.autosave')
  await writeAutosave(a, 'old copy')
  const crashing = {
    ...realFs,
    rename: async () => { throw new Error('power cut') }
  }
  await expect(writeAutosave(a, 'new copy', crashing as any)).rejects.toThrow()
  expect(await readFile(a, 'utf8')).toBe('old copy')
  await expect(readFile(`${a}.tmp`, 'utf8')).rejects.toThrow()
  await writeAutosave(a, 'new copy')
  expect(await readFile(a, 'utf8')).toBe('new copy')
})
