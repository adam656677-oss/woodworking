// Saving and loading project files safely: write to a temp file, keep the last version as .bak, then swap.
import * as nodeFs from 'node:fs/promises'
import { join } from 'node:path'

export type FsLike = Pick<typeof nodeFs, 'writeFile' | 'rename' | 'stat' | 'readFile' | 'copyFile' | 'mkdir' | 'rm'>

const SAVE_FAILED = "Couldn't save — disk full or no permission. Your last saved version is safe."

export function defaultFolder(docsDir: string): string {
  return join(docsDir, 'A&A Woodworking')
}

export function autosavePath(path: string | null, docsDir: string): string {
  return path ? `${path}.autosave` : join(defaultFolder(docsDir), 'Untitled.aaw.autosave')
}

async function exists(fs: FsLike, p: string): Promise<boolean> {
  try {
    await fs.stat(p)
    return true
  } catch {
    return false
  }
}

const wait = (ms: number) => new Promise(r => setTimeout(r, ms))

/** OneDrive sync and antivirus scanners hold files open for a moment; those errors clear on a retry. */
export async function renameWithRetry(fs: FsLike, from: string, to: string, delayMs: number): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      await fs.rename(from, to)
      return
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code
      if (attempt >= 4 || (code !== 'EBUSY' && code !== 'EPERM' && code !== 'EACCES')) throw e
      await wait(delayMs * attempt)
    }
  }
}

// Saves of one file wait for the one before, so two never share the temp file.
const queues = new Map<string, Promise<unknown>>()

/** Save without ever destroying the last good file. Saves of the same file run one after another. */
export function safeSave(path: string, text: string, fs: FsLike = nodeFs, retryDelayMs = 100): Promise<void> {
  const run = (queues.get(path) ?? Promise.resolve()).catch(() => {}).then(() => saveNow(path, text, fs, retryDelayMs))
  queues.set(path, run)
  void run.finally(() => { if (queues.get(path) === run) queues.delete(path) }).catch(() => {})
  return run
}

/**
 * A JSON data file: its contents, or the last good copy (.bak) when the file is damaged — `damaged` says so,
 * so the caller can keep from overwriting it with less. Null when there's no file yet.
 */
export async function loadJson(path: string, fs: FsLike = nodeFs): Promise<{ data: unknown; damaged: boolean }> {
  let text: string
  try { text = await fs.readFile(path, 'utf8') } catch { return { data: null, damaged: false } }
  try { return { data: JSON.parse(text), damaged: false } } catch { /* fall through to the backup */ }
  try { return { data: JSON.parse(await fs.readFile(`${path}.bak`, 'utf8')), damaged: true } } catch { return { data: null, damaged: true } }
}

async function saveNow(path: string, text: string, fs: FsLike, retryDelayMs: number): Promise<void> {
  const tmp = `${path}.tmp`
  try {
    await fs.writeFile(tmp, text, 'utf8')
    if (await exists(fs, path)) await fs.copyFile(path, `${path}.bak`)
    await renameWithRetry(fs, tmp, path, retryDelayMs)
  } catch {
    await fs.rm(tmp, { force: true }).catch(() => {})
    throw new Error(SAVE_FAILED)
  }
}

/** Remove an autosave side file once the real file is saved (a missing file is fine). */
export async function deleteAutosave(path: string, fs: FsLike = nodeFs): Promise<void> {
  await fs.rm(path, { force: true })
}

/** Write the autosave side file (failures are reported but never touch the real file). */
export async function writeAutosave(path: string, text: string, fs: FsLike = nodeFs): Promise<void> {
  await fs.writeFile(path, text, 'utf8')
}

export async function load(path: string, fs: FsLike = nodeFs) {
  const text = await fs.readFile(path, 'utf8')
  const a = `${path}.autosave`
  let autosaveNewer = false
  try {
    const [f, s] = await Promise.all([fs.stat(path), fs.stat(a)])
    autosaveNewer = s.mtimeMs > f.mtimeMs
  } catch {
    autosaveNewer = false
  }
  return { text, autosaveNewer, autosavePath: a, backupPath: `${path}.bak` }
}
