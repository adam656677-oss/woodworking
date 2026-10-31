// The Kids' Workshop's saved progress and the parent PIN, kept in the app's settings folder.
import { pbkdf2, randomBytes, timingSafeEqual } from 'node:crypto'
import { readFile, rename, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { isProgress, newProgress, type Progress } from '../src/kids/progress'
import { safeSave } from './fileStore'

const derive = promisify(pbkdf2)
const ITERATIONS = 100_000
const KEY_BYTES = 32

// More than one child: kids-profiles.json lists them. The first child keeps the original kids-progress.json,
// so a workshop set up before profiles existed carries on as child number one.
export type Profiles = { active: string; profiles: { id: string; name: string }[] }
const profilesPath = (dir: string) => join(dir, 'kids-profiles.json')
const progressFile = (dir: string, id: string) => join(dir, id === 'main' ? 'kids-progress.json' : `kids-progress-${id}.json`)
const validId = (id: unknown): id is string => typeof id === 'string' && (id === 'main' || /^k[0-9a-f]{8}$/.test(id))
/** A finished-project photo's file name; children after the first get their id in front. */
export const photoName = (profile: string, projectId: string) => (profile === 'main' ? `${projectId}.jpg` : `${profile}-${projectId}.jpg`)

const goodProfiles = (v: any): v is Profiles => validId(v?.active) && Array.isArray(v.profiles) && v.profiles.length > 0 && v.profiles.every((p: any) => validId(p?.id) && typeof p.name === 'string') && v.profiles.some((p: any) => p.id === v.active)

/**
 * The children. No list yet means one child (a workshop from before profiles). A list that can't be read is never
 * taken as "one child" — that would send a second child's saves into the first child's record: the backup copy is
 * used, and if that can't be read either, this throws and nothing is saved.
 */
export async function loadProfiles(dir: string): Promise<Profiles> {
  let text: string | null = null
  try { text = await readFile(profilesPath(dir), 'utf8') } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error("The list of children couldn't be read right now. Try again in a moment.")
  }
  if (text !== null) {
    try { const v = JSON.parse(text); if (goodProfiles(v)) return v } catch { /* damaged: try the backup */ }
    try { const v = JSON.parse(await readFile(`${profilesPath(dir)}.bak`, 'utf8')); if (goodProfiles(v)) return v } catch { /* no good backup */ }
    throw new Error("The list of children is damaged. Restore a backup, or ask for help; nothing was changed.")
  }
  const first = await readProgress(progressFile(dir, 'main')) ?? await readProgress(`${progressFile(dir, 'main')}.bak`)
  return { active: 'main', profiles: [{ id: 'main', name: first?.childName ?? '' }] }
}
const saveProfiles = (dir: string, p: Profiles) => safeSave(profilesPath(dir), JSON.stringify(p, null, 2))

export async function addProfile(dir: string, name: string): Promise<string> {
  const p = await loadProfiles(dir)
  const id = `k${randomBytes(4).toString('hex')}`
  const n = name.trim().slice(0, 40)
  // A new child starts with hand tools only; the parent raises it when they're ready.
  await safeSave(progressFile(dir, id), JSON.stringify({ ...newProgress(), childName: n, tier: 'beginner' }, null, 2))
  await saveProfiles(dir, { ...p, profiles: [...p.profiles, { id, name: n }] })
  return id
}

export async function switchProfile(dir: string, id: string): Promise<void> {
  const p = await loadProfiles(dir)
  if (!p.profiles.some(x => x.id === id)) throw new Error('There is no such child')
  await saveProfiles(dir, { ...p, active: id })
}

/** Takes a child off the list. Their record is kept beside the others, renamed, in case it was a mistake. */
export async function removeProfile(dir: string, id: string): Promise<void> {
  const p = await loadProfiles(dir)
  if (!p.profiles.some(x => x.id === id)) throw new Error('There is no such child')
  if (p.profiles.length === 1) throw new Error("The last child can't be removed")
  const rest = p.profiles.filter(x => x.id !== id)
  const file = progressFile(dir, id)
  if (await exists(file)) await rename(file, `${file}.removed-${Date.now()}`)
  await saveProfiles(dir, { active: p.active === id ? rest[0].id : p.active, profiles: rest })
}

/** Every child's progress, for the parent's family page. */
export async function familyProgress(dir: string): Promise<{ id: string; name: string; progress: Progress }[]> {
  const p = await loadProfiles(dir)
  const out = []
  for (const x of p.profiles) out.push({ id: x.id, name: x.name, progress: (await loadProgress(dir, x.id)).progress })
  return out
}
export const pinFilePath = (dir: string) => join(dir, 'kids-pin.json')

async function readProgress(path: string): Promise<Progress | null> {
  try {
    const v = JSON.parse(await readFile(path, 'utf8'))
    return isProgress(v) ? v : null
  } catch {
    return null
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

/** Load progress; a damaged file falls back to its backup, then to a fresh start. Never throws. */
export async function loadProgress(dir: string, profile?: string): Promise<{ progress: Progress; notice: string | null }> {
  const main = progressFile(dir, profile ?? (await loadProfiles(dir)).active)
  const p = await readProgress(main)
  if (p) return { progress: p, notice: null }
  // Missing or unreadable (damaged, or briefly locked by OneDrive): the backup copy is next best.
  const bak = await readProgress(`${main}.bak`)
  if (bak) return { progress: bak, notice: 'Progress was restored from the backup copy.' }
  if (!(await exists(main))) return { progress: newProgress(), notice: null }
  return { progress: newProgress(), notice: "Progress couldn't be read and was started fresh." }
}

/** Saves a child's progress: the child it belongs to (the one working now when not given). */
export async function saveProgress(dir: string, p: Progress, profile?: string): Promise<void> {
  if (!isProgress(p)) throw new Error('Progress is not valid and was not saved')
  const profiles = await loadProfiles(dir)
  const who = profile ?? profiles.active
  if (!profiles.profiles.some(x => x.id === who)) throw new Error('That child is not in the list; progress was not saved')
  await safeSave(progressFile(dir, who), JSON.stringify(p, null, 2))
  // Keep the family list's name in step (only once there is a list).
  const me = profiles.profiles.find(x => x.id === who)
  if (me && me.name !== p.childName && (await exists(profilesPath(dir)))) await saveProfiles(dir, { ...profiles, profiles: profiles.profiles.map(x => (x.id === me.id ? { ...x, name: p.childName } : x)) })
}

export async function pinIsSet(dir: string): Promise<boolean> {
  try {
    const v = JSON.parse(await readFile(pinFilePath(dir), 'utf8'))
    return typeof v?.salt === 'string' && typeof v?.hash === 'string'
  } catch {
    return false
  }
}

export async function setPin(dir: string, pin: string): Promise<void> {
  if (!/^\d{4}$/.test(pin)) throw new Error('PIN must be 4 digits')
  const salt = randomBytes(16)
  const hash = await derive(pin, salt, ITERATIONS, KEY_BYTES, 'sha256')
  await safeSave(pinFilePath(dir), JSON.stringify({ salt: salt.toString('hex'), hash: hash.toString('hex') }))
}

export async function checkPin(dir: string, pin: string): Promise<boolean> {
  if (typeof pin !== 'string' || !/^\d{4}$/.test(pin)) return false
  try {
    const { salt, hash } = JSON.parse(await readFile(pinFilePath(dir), 'utf8'))
    const want = Buffer.from(hash, 'hex')
    const got = await derive(pin, Buffer.from(salt, 'hex'), ITERATIONS, KEY_BYTES, 'sha256')
    return want.length === got.length && timingSafeEqual(want, got)
  } catch {
    return false
  }
}
