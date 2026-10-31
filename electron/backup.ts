// Full backup and restore, and project packages for sharing. Both are gzip-compressed JSON.
// A backup holds the app's own data files (kids' progress and photos, journal, inventory, stock, woods) and the
// whole projects folder (projects, My Plans). Restoring never deletes: files it would replace are moved aside first.
import { copyFile, mkdir, readdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { dirname, join, sep } from 'node:path'
import { gunzipSync, gzipSync } from 'node:zlib'

export type BackupFile = { area: 'user' | 'docs'; path: string; data: string }
type Backup = { format: 'aa-backup'; version: 1; created: string; files: BackupFile[] }

// App data files worth keeping (not Electron's own caches and settings).
const USER_FILE = /^(kids-[a-z0-9-]+\.json|journal\.json|inventory\.json|stock\.json|woods\.json)$/
const SKIP = /\.(tmp|bak|autosave|damaged)$|\.removed-\d+$|^_before-restore-/

async function walk(root: string, rel = ''): Promise<string[]> {
  let names: string[]
  try { names = await readdir(join(root, rel)) } catch { return [] }
  const out: string[] = []
  for (const n of names) {
    if (SKIP.test(n)) continue
    const r = rel ? `${rel}/${n}` : n
    const s = await stat(join(root, r)).catch(() => null)
    if (s?.isDirectory()) out.push(...(await walk(root, r)))
    else if (s?.isFile()) out.push(r)
  }
  return out
}

export async function collectBackup(userData: string, docsRoot: string): Promise<BackupFile[]> {
  const files: BackupFile[] = []
  for (const n of await readdir(userData).catch(() => [] as string[])) {
    if (USER_FILE.test(n)) files.push({ area: 'user', path: n, data: (await readFile(join(userData, n))).toString('base64') })
  }
  for (const p of await walk(join(userData, 'kids-photos'))) files.push({ area: 'user', path: `kids-photos/${p}`, data: (await readFile(join(userData, 'kids-photos', ...p.split('/')))).toString('base64') })
  for (const p of await walk(docsRoot)) files.push({ area: 'docs', path: p, data: (await readFile(join(docsRoot, ...p.split('/')))).toString('base64') })
  return files
}

export async function writeBackup(path: string, files: BackupFile[]): Promise<void> {
  const b: Backup = { format: 'aa-backup', version: 1, created: new Date().toISOString(), files }
  await writeFile(path, gzipSync(Buffer.from(JSON.stringify(b))))
}

/** A relative path with ordinary names only: no "..", no drive or root, no backslashes. */
const safePath = (p: unknown): p is string => typeof p === 'string' && p.length > 0 && p.length < 500 && !/^[/\\]|^[a-zA-Z]:|\\|\0/.test(p) && p.split('/').every(s => s && s !== '.' && s !== '..')

export async function readBackup(path: string): Promise<Backup> {
  const NOT = "That file isn't an A&A Woodworking backup, or it's damaged."
  let b: any
  try { b = JSON.parse(gunzipSync(await readFile(path)).toString('utf8')) } catch { throw new Error(NOT) }
  const ok = b && b.format === 'aa-backup' && b.version === 1 && Array.isArray(b.files) &&
    b.files.every((f: any) => f && (f.area === 'user' || f.area === 'docs') && safePath(f.path) && typeof f.data === 'string' &&
      (f.area === 'docs' || USER_FILE.test(f.path) || /^kids-photos\/[a-z0-9-]+\.jpg$/.test(f.path)))
  if (!ok) throw new Error(NOT)
  return b as Backup
}

const stamp = () => new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)

/** Puts a backup's files back. Files it replaces go to a _before-restore-… folder in the same place. */
export async function restoreBackup(path: string, userData: string, docsRoot: string): Promise<{ files: number; keptUser: string | null; keptDocs: string | null }> {
  const b = await readBackup(path)
  const kept = { user: null as string | null, docs: null as string | null }
  const aside = `_before-restore-${stamp()}`
  for (const f of b.files) {
    const root = f.area === 'user' ? userData : docsRoot
    const dest = join(root, ...f.path.split('/'))
    if (!dest.startsWith(root + sep) && dest !== root) throw new Error("That file isn't an A&A Woodworking backup, or it's damaged.")
    const data = Buffer.from(f.data, 'base64')
    const old = await readFile(dest).catch(() => null)
    if (old && !old.equals(data)) {
      const keep = join(root, aside, ...f.path.split('/'))
      await mkdir(dirname(keep), { recursive: true })
      await copyFile(dest, keep)
      kept[f.area] = aside
    }
    await mkdir(dirname(dest), { recursive: true })
    await writeFile(`${dest}.tmp`, data)
    await rename(`${dest}.tmp`, dest)
  }
  return { files: b.files.length, keptUser: kept.user, keptDocs: kept.docs }
}

/** A project to share: the design, its journal entries (with photos) and who it's from. */
export type Package = { format: 'aa-package'; version: 1; name: string; project: string; journal: unknown[]; from?: string; note?: string }

export async function writePackage(path: string, p: Package): Promise<void> {
  await writeFile(path, gzipSync(Buffer.from(JSON.stringify(p))))
}

export async function readPackage(path: string): Promise<Package> {
  let p: any
  try { p = JSON.parse(gunzipSync(await readFile(path)).toString('utf8')) } catch { p = null }
  if (!p || p.format !== 'aa-package' || p.version !== 1 || typeof p.name !== 'string' || typeof p.project !== 'string' || !Array.isArray(p.journal)) {
    throw new Error("That file isn't an A&A Woodworking project package, or it's damaged.")
  }
  return p as Package
}
