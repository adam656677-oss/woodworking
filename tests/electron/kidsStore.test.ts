import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { checkPin, loadProgress, pinFilePath, pinIsSet, saveProgress, setPin } from '../../electron/kidsStore'
import { newProgress } from '../../src/kids/progress'

let dir: string
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'aa-kids-'))
})

test('no progress file yet: a fresh start, no notice', async () => {
  expect(await loadProgress(dir)).toEqual({ progress: newProgress(), notice: null })
})

test('progress saves and loads back the same', async () => {
  const p = { ...newProgress(), childName: 'Sam', passedQuizzes: { 'quiz-1': '2026-10-28' } }
  await saveProgress(dir, p)
  expect((await loadProgress(dir)).progress).toEqual(p)
})

test('a damaged file falls back to the backup copy', async () => {
  const good = { ...newProgress(), childName: 'Sam' }
  await saveProgress(dir, good)
  await saveProgress(dir, { ...good, tier: 'advanced' }) // the first version is now the .bak
  await writeFile(join(dir, 'kids-progress.json'), '{ broken')
  expect(await loadProgress(dir)).toEqual({ progress: good, notice: 'Progress was restored from the backup copy.' })
})

test('a damaged file and a damaged backup start fresh, with a plain notice', async () => {
  await writeFile(join(dir, 'kids-progress.json'), '{ broken')
  await writeFile(join(dir, 'kids-progress.json.bak'), '"nope"')
  expect(await loadProgress(dir)).toEqual({ progress: newProgress(), notice: "Progress couldn't be read and was started fresh." })
})

test('saving refuses a grown-up-only tier or a malformed record', async () => {
  await expect(saveProgress(dir, { ...newProgress(), tier: 'adult' } as never)).rejects.toThrow()
  await expect(saveProgress(dir, { childName: 'x' } as never)).rejects.toThrow()
})

test('the PIN is checked against a salted hash, never stored as plain text', async () => {
  expect(await pinIsSet(dir)).toBe(false)
  await setPin(dir, '1234')
  expect(await pinIsSet(dir)).toBe(true)
  expect(await checkPin(dir, '1234')).toBe(true)
  expect(await checkPin(dir, '4321')).toBe(false)
  expect(await readFile(pinFilePath(dir), 'utf8')).not.toContain('1234')
})

test('a PIN must be exactly 4 digits', async () => {
  await expect(setPin(dir, 'abcd')).rejects.toThrow('PIN must be 4 digits')
  await expect(setPin(dir, '12345')).rejects.toThrow('PIN must be 4 digits')
  await expect(setPin(dir, '12a4')).rejects.toThrow('PIN must be 4 digits')
})

test('with no PIN file, every PIN check fails', async () => {
  expect(await checkPin(dir, '0000')).toBe(false)
})

test('deleting the PIN file (forgot PIN) keeps the progress', async () => {
  const p = { ...newProgress(), childName: 'Sam' }
  await saveProgress(dir, p)
  await setPin(dir, '1234')
  await rm(pinFilePath(dir))
  expect(await pinIsSet(dir)).toBe(false)
  expect((await loadProgress(dir)).progress).toEqual(p)
})
