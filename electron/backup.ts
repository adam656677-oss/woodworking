// Full backup and restore, and project packages for sharing. Both are gzip-compressed JSON.
// A backup holds the app's own data files (kids' progress, profiles, PIN and photos; journal, inventory, stock,
// woods) and the whole projects folder (projects, My Plans). Restoring never loses a file: every file it would
// replace is copied aside first, and if anything goes wrong part-way, what was already put back is undone.
import * as nodeFs from 'node:fs/promises'
import { copyFile, lstat, mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join, sep } from 'node:path'
import { promisify } from 'node:util'
import { gunzip, gzip } from 'node:zlib'
import { randomBytes } from 'node:crypto'
import { renameWithRetry } from './fileStore'

const gz = promisify(gzip), gunz = promisify(gunzip)

export type BackupFile = { area: 'user' | 'docs'; path: string; data: string }
type Backup = { format: 'aa-backup'; version: 1; created: string; files: BackupFile[] }

// App data files worth keeping (not Electron's own caches and settings). Collect and restore use the same test.
const USER_FILE = /^(kids-[a-z0-9-]+\.json|journal\.json|inventory\.json|stock\.json|woods\.json)$/
const KID_PHOTO = /^kids-photos\/[a-z0-9-]+\.jpg$/
export const isUserPath = (p: string) => USER_FILE.test(p) || KID_PHOTO.test(p)
const SKIP = /\.(tmp|bak|autosave|damaged|restore-tmp)$|\.removed-\d+$|^_before-restore-|^(thumbs\.db|desktop\.ini|\.ds_store)$/i
/** The most a backup can hold before it has to be made another way (the whole thing is built in memory). */
export const MAX_BACKUP_BYTES = 300 * 1024 * 1024

const NOT_BACKUP = "That file isn't an A&A Woodworking backup, or it's damaged. Nothing was changed."

// Names Windows can't have: device names, characters it forbids, trailing dots or spaces.
const RESERVED = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i
const okSegment = (s: string) => !!s && s !== '.' && s !== '..' && !/[<>:"|?*\u0000-\u001f\\]/.test(s) && !/[. ]$/.test(s) && !RESERVED.test(s)
/** A relative path of ordinary names that is safe to write on Windows (no "..", drive, root or odd names). */
export const safePath = (p: unknown): p is string => typeof p === 'string' && p.length > 0 && p.length < 400 && !/^[/\\]/.test(p) && p.split('/').every(okSegment)

async function walk(root: string, rel = ''): Promise<string[]> {
  let names: string[]
  try { names = await readdir(join(root, rel)) } catch { return [] }
  const out: string[] = []
  for (const n of names) {
    if (SKIP.test(n)) continue
    const r = rel ? `${rel}/${n}` : n
    // lstat: folder links (junctions) aren't followed, so a link back up the tree can't loop.
    const s = await lstat(join(root, r)).catch(() => null)
    if (s?.isDirectory()) out.push(...(await walk(root, r)))
    else if (s?.isFile()) out.push(r)
  }
  return out
}

/** Everything a backup takes, and the files that couldn't be read (locked, or in the cloud while offline). */
export async function collectBackup(userData: string, docsRoot: string): Promise<{ files: BackupFile[]; skipped: string[] }> {
  const files: BackupFile[] = [], skipped: string[] = []
  let bytes = 0
  const add = async (area: 'user' | 'docs', root: string, p: string) => {
    if (!safePath(p) || (area === 'user' && !isUserPath(p))) return skipped.push(p)
    try {
      const data = await readFile(join(root, ...p.split('/')))
      bytes += data.length
      if (bytes > MAX_BACKUP_BYTES) throw Object.assign(new Error('too big'), { tooBig: true })
      files.push({ area, path: p, data: data.toString('base64') })
    } catch (e) {
      if ((e as { tooBig?: boolean }).tooBig) throw new Error('There is too much to back up in one file (more than 300 MB). Copy the "A&A Woodworking" folder in Documents to a USB stick instead, and back up again to save the rest.')
      skipped.push(p)
    }
  }
  for (const n of await readdir(userData).catch(() => [] as string[])) if (USER_FILE.test(n)) await add('user', userData, n)
  for (const p of await walk(join(userData, 'kids-photos'))) await add('user', userData, `kids-photos/${p}`)
  for (const p of await walk(docsRoot)) await add('docs', docsRoot, p)
  return { files, skipped }
}

/** Writes the backup beside its final name, reads it back to be sure, then puts it in place. */
export async function writeBackup(path: string, files: BackupFile[]): Promise<void> {
  const b: Backup = { format: 'aa-backup', version: 1, created: new Date().toISOString(), files }
  const tmp = `${path}.tmp`
  await writeFile(tmp, await gz(Buffer.from(JSON.stringify(b))))
  try {
    const back = await readBackup(tmp)
    if (back.files.length !== files.length) throw new Error('mismatch')
  } catch {
    await rm(tmp, { force: true })
    throw new Error("The backup couldn't be checked after writing it. Try another place, like a different folder or drive.")
  }
  await renameWithRetry(nodeFs, tmp, path, 100)
}

export async function readBackup(path: string): Promise<Backup> {
  let b: any
  try { b = JSON.parse((await gunz(await readFile(path))).toString('utf8')) } catch { throw new Error(NOT_BACKUP) }
  const seen = new Set<string>()
  const ok = b && b.format === 'aa-backup' && b.version === 1 && Array.isArray(b.files) &&
    b.files.every((f: any) => {
      if (!f || (f.area !== 'user' && f.area !== 'docs') || !safePath(f.path) || typeof f.data !== 'string') return false
      if (f.area === 'user' && !isUserPath(f.path)) return false
      // Two entries for one file (or ones that differ only in capitals, the same file on Windows): refused.
      const key = `${f.area}:${f.path.toLowerCase()}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  if (!ok) throw new Error(NOT_BACKUP)
  return b as Backup
}

const exists = async (p: string): Promise<boolean> => {
  try { await stat(p); return true } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return false
    // Locked, or a cloud file that can't be reached: can't be sure it's safe to replace.
    throw new Error(`"${p}" couldn't be checked (it may be open, locked or not downloaded). Close it and try again. Nothing was changed.`)
  }
}

export type RestoreResult = { files: number; keptUser: string | null; keptDocs: string | null }

/**
 * Puts a backup's files back, in two steps: first every new file is written beside its place and every file it
 * replaces is copied aside (to _before-restore-…); only then are the new files moved into place. If any step fails,
 * whatever was already moved is put back, and the error says nothing was changed.
 */
export async function restoreBackup(path: string, userData: string, docsRoot: string): Promise<RestoreResult> {
  const b = await readBackup(path)
  const aside = `_before-restore-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}-${randomBytes(2).toString('hex')}`
  const plan: { dest: string; tmp: string; keep: string | null; area: 'user' | 'docs' }[] = []
  const kept = { user: false, docs: false }
  try {
    for (const f of b.files) {
      const root = f.area === 'user' ? userData : docsRoot
      const dest = join(root, ...f.path.split('/'))
      if (!dest.startsWith(root + sep)) throw new Error(NOT_BACKUP)
      const data = Buffer.from(f.data, 'base64')
      let keep: string | null = null
      if (await exists(dest)) {
        const old = await readFile(dest)
        if (old.equals(data)) continue
        keep = join(root, aside, ...f.path.split('/'))
        await mkdir(dirname(keep), { recursive: true })
        await copyFile(dest, keep)
        kept[f.area] = true
        // An autosave of a project being put back would offer to "recover" the old version: set it aside too.
        if (f.area === 'docs' && /\.aaw$/i.test(dest) && (await exists(`${dest}.autosave`))) await rename(`${dest}.autosave`, `${keep}.autosave`)
      }
      const tmp = `${dest}.restore-tmp`
      await mkdir(dirname(dest), { recursive: true })
      await writeFile(tmp, data)
      plan.push({ dest, tmp, keep, area: f.area })
    }
  } catch (e) {
    await Promise.all(plan.map(p => rm(p.tmp, { force: true })))
    throw e instanceof Error && /Nothing was changed/.test(e.message) ? e : new Error(`The restore couldn't get ready (${(e as Error).message}). Nothing was changed.`)
  }
  const done: typeof plan = []
  try {
    for (const p of plan) { await renameWithRetry(nodeFs, p.tmp, p.dest, 100); done.push(p) }
  } catch (e) {
    // Put back what was already moved in.
    for (const p of done.reverse()) {
      if (p.keep) await copyFile(p.keep, p.dest).catch(() => {})
      else await rm(p.dest, { force: true }).catch(() => {})
    }
    await Promise.all(plan.map(p => rm(p.tmp, { force: true })))
    throw new Error(`The restore didn't finish (${(e as Error).message}), so everything was put back as it was.`)
  }
  return { files: b.files.length, keptUser: kept.user ? join(userData, aside) : null, keptDocs: kept.docs ? join(docsRoot, aside) : null }
}

/** A project to share: the design, its journal entries (with photos) and who it's from. */
export type Package = { format: 'aa-package'; version: 1; name: string; project: string; journal: unknown[]; from?: string; note?: string }
/** The biggest package that will be opened (photos included). */
export const MAX_PACKAGE_BYTES = 100 * 1024 * 1024

export async function writePackage(path: string, p: Package): Promise<void> {
  const tmp = `${path}.tmp`
  await writeFile(tmp, await gz(Buffer.from(JSON.stringify(p))))
  await renameWithRetry(nodeFs, tmp, path, 100)
}

export async function readPackage(path: string): Promise<Package> {
  const NOT = "That file isn't an A&A Woodworking project package, or it's damaged."
  let p: any
  try {
    const raw = await gunz(await readFile(path), { maxOutputLength: MAX_PACKAGE_BYTES })
    p = JSON.parse(raw.toString('utf8'))
  } catch { p = null }
  const optStr = (v: unknown) => v === undefined || (typeof v === 'string' && v.length < 2000)
  if (!p || p.format !== 'aa-package' || p.version !== 1 || typeof p.name !== 'string' || typeof p.project !== 'string' || !Array.isArray(p.journal) || !optStr(p.from) || !optStr(p.note)) throw new Error(NOT)
  return p as Package
}
