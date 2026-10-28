// Saving and loading project files safely: write to a temp file, keep the last version as .bak, then swap.
import * as nodeFs from 'node:fs/promises'
import { join } from 'node:path'

export type FsLike = Pick<typeof nodeFs, 'writeFile' | 'rename' | 'stat' | 'readFile' | 'copyFile' | 'mkdir'>

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

/** Save without ever destroying the last good file. */
export async function safeSave(path: string, text: string, fs: FsLike = nodeFs): Promise<void> {
  const tmp = `${path}.tmp`
  try {
    await fs.writeFile(tmp, text, 'utf8')
    if (await exists(fs, path)) await fs.copyFile(path, `${path}.bak`)
    await fs.rename(tmp, path)
  } catch {
    throw new Error(SAVE_FAILED)
  }
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
