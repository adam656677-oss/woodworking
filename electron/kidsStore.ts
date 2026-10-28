// The Kids' Workshop's saved progress and the parent PIN, kept in the app's settings folder.
import { pbkdf2, randomBytes, timingSafeEqual } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { isProgress, newProgress, type Progress } from '../src/kids/progress'
import { safeSave } from './fileStore'

const derive = promisify(pbkdf2)
const ITERATIONS = 100_000
const KEY_BYTES = 32

const progressPath = (dir: string) => join(dir, 'kids-progress.json')
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
export async function loadProgress(dir: string): Promise<{ progress: Progress; notice: string | null }> {
  const main = progressPath(dir)
  const p = await readProgress(main)
  if (p) return { progress: p, notice: null }
  // Missing or unreadable (damaged, or briefly locked by OneDrive): the backup copy is next best.
  const bak = await readProgress(`${main}.bak`)
  if (bak) return { progress: bak, notice: 'Progress was restored from the backup copy.' }
  if (!(await exists(main))) return { progress: newProgress(), notice: null }
  return { progress: newProgress(), notice: "Progress couldn't be read and was started fresh." }
}

export async function saveProgress(dir: string, p: Progress): Promise<void> {
  if (!isProgress(p)) throw new Error('Progress is not valid and was not saved')
  await safeSave(progressPath(dir), JSON.stringify(p, null, 2))
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
