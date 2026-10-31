import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { addProfile, checkPin, familyProgress, loadProfiles, loadProgress, photoName, removeProfile, switchProfile, pinFilePath, pinIsSet, saveProgress, setPin } from '../../electron/kidsStore'
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

test('only the backup copy is there: progress comes back from it', async () => {
  const good = { ...newProgress(), childName: 'Sam', passedQuizzes: { 'quiz-1': '2026-10-28' } }
  await writeFile(join(dir, 'kids-progress.json.bak'), JSON.stringify(good))
  expect(await loadProgress(dir)).toEqual({ progress: good, notice: 'Progress was restored from the backup copy.' })
})

describe('more than one child', () => {
  test('an existing single child becomes the first profile; a new child gets a fresh record', async () => {
    const first = { ...newProgress(), childName: 'Sam', passedQuizzes: { 'quiz-1': '2026-10-01' } }
    await saveProgress(dir, first)
    const p0 = await loadProfiles(dir)
    expect(p0).toEqual({ active: 'main', profiles: [{ id: 'main', name: 'Sam' }] })
    const id = await addProfile(dir, 'Riley')
    expect(id).toMatch(/^k[0-9a-f]{8}$/)
    expect((await loadProfiles(dir)).profiles.map(p => p.name)).toEqual(['Sam', 'Riley'])
    // Still Sam until switched.
    expect((await loadProgress(dir)).progress.childName).toBe('Sam')
    await switchProfile(dir, id)
    const r = await loadProgress(dir)
    expect(r.progress.childName).toBe('Riley')
    expect(r.progress.passedQuizzes).toEqual({})
    // Riley's saves don't touch Sam's record.
    await saveProgress(dir, { ...r.progress, openedLessons: ['l1'] })
    await switchProfile(dir, 'main')
    expect((await loadProgress(dir)).progress.passedQuizzes).toEqual({ 'quiz-1': '2026-10-01' })
    expect((await loadProgress(dir)).progress.openedLessons).toEqual([])
    const fam = await familyProgress(dir)
    expect(fam.map(f => [f.name, f.progress.openedLessons.length])).toEqual([['Sam', 0], ['Riley', 1]])
  })
  test('switching to a child that does not exist is refused; the last child cannot be removed', async () => {
    await expect(switchProfile(dir, 'knope0000')).rejects.toThrow()
    await expect(removeProfile(dir, 'main')).rejects.toThrow(/last/i)
    const id = await addProfile(dir, 'Riley')
    await switchProfile(dir, id)
    await removeProfile(dir, id)
    const p = await loadProfiles(dir)
    expect(p.profiles.map(x => x.id)).toEqual(['main'])
    expect(p.active).toBe('main')
  })
  test('a name change is kept in the family list', async () => {
    await saveProgress(dir, { ...newProgress(), childName: 'Sammy' })
    expect((await loadProfiles(dir)).profiles[0].name).toBe('Sammy')
  })
  test('photo names: the first child keeps plain names, others get their id in front', () => {
    expect(photoName('main', 'birdhouse')).toBe('birdhouse.jpg')
    expect(photoName('k1234abcd', 'birdhouse')).toBe('k1234abcd-birdhouse.jpg')
  })
})

describe('more than one child — safety', () => {
  test('a damaged children list uses its backup copy, and never sends one child\'s saves into another\'s record', async () => {
    await saveProgress(dir, { ...newProgress(), childName: 'Andrew', openedLessons: ['a1'] })
    const bella = await addProfile(dir, 'Bella')
    await switchProfile(dir, bella)
    await switchProfile(dir, bella) // saves the list twice, so its .bak is good
    await writeFile(join(dir, 'kids-profiles.json'), '{ damaged')
    const p = await loadProfiles(dir)
    expect(p.profiles.map(x => x.name)).toEqual(['Andrew', 'Bella'])
    await writeFile(join(dir, 'kids-profiles.json.bak'), 'also damaged')
    await expect(loadProfiles(dir)).rejects.toThrow(/damaged/)
    await expect(saveProgress(dir, { ...newProgress(), childName: 'Bella', openedLessons: ['b1'] })).rejects.toThrow()
    expect(JSON.parse(await readFile(join(dir, 'kids-progress.json'), 'utf8')).openedLessons).toEqual(['a1'])
  })
  test('a save goes to the child it belongs to, even after a switch', async () => {
    await saveProgress(dir, { ...newProgress(), childName: 'Andrew' })
    const bella = await addProfile(dir, 'Bella')
    await switchProfile(dir, bella)
    await saveProgress(dir, { ...newProgress(), childName: 'Andrew', openedLessons: ['late'] }, 'main')
    expect((await loadProgress(dir, 'main')).progress.openedLessons).toEqual(['late'])
    expect((await loadProgress(dir, bella)).progress.openedLessons).toEqual([])
    await expect(saveProgress(dir, newProgress(), 'k00000000')).rejects.toThrow()
  })
  test('a new child starts at the beginner tool level', async () => {
    const id = await addProfile(dir, 'Riley')
    expect((await loadProgress(dir, id)).progress.tier).toBe('beginner')
  })
})
