import { mkdtemp, readFile, utimes, writeFile } from 'node:fs/promises'
import * as realFs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { autosavePath, defaultFolder, deleteAutosave, load, safeSave } from '../../electron/fileStore'

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
