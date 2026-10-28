import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  attachDesign, createPlanFolder, deletePlanFolder, folderName, listPlans, loadPlan, plansRoot, readDesign, savePage, savePlan
} from '../../electron/plansStore'
import { newPlan } from '../../src/plans/types'

let root: string
beforeEach(async () => {
  root = plansRoot(await mkdtemp(join(tmpdir(), 'aa-plans-')))
})

test('plans live in Documents/A&A Woodworking/Plans', () => {
  expect(plansRoot('C:/Users/me/Documents').replace(/\\/g, '/')).toBe('C:/Users/me/Documents/A&A Woodworking/Plans')
})

test('folder names drop characters Windows forbids and never clash', () => {
  expect(folderName('Shelf: v2?', [])).toBe('Shelf v2')
  expect(folderName('Box', ['Box', 'Box (2)'])).toBe('Box (3)')
  expect(folderName('  ..  ', [])).toBe('Plan')
  expect(folderName('a<b>c|d"e*f/g\\h', [])).toBe('abcdefgh')
})

test('a plan saves, lists and loads back the same', async () => {
  const p = { ...newPlan('Step stool', 'p_1'), notes: 'Pine' }
  const folder = await createPlanFolder(root, p)
  expect(folder).toBe('Step stool')
  await savePlan(root, folder, { ...p, stars: 2 })
  expect((await loadPlan(root, folder)).plan.stars).toBe(2)
  const list = await listPlans(root)
  expect(list.map(x => [x.folder, x.plan?.name])).toEqual([['Step stool', 'Step stool']])
})

test('two plans with the same name get separate folders', async () => {
  const a = await createPlanFolder(root, newPlan('Box', 'p_a'))
  const b = await createPlanFolder(root, newPlan('Box', 'p_b'))
  expect([a, b]).toEqual(['Box', 'Box (2)'])
})

test('a damaged plan.json falls back to the backup copy', async () => {
  const p = newPlan('Box', 'p_1')
  const folder = await createPlanFolder(root, p)
  await savePlan(root, folder, { ...p, notes: 'first' })
  await savePlan(root, folder, { ...p, notes: 'second' }) // "first" is now the .bak
  await writeFile(join(root, folder, 'plan.json'), '{ broken')
  const r = await loadPlan(root, folder)
  expect(r.plan.notes).toBe('first')
  expect(r.notice).toBe('This plan was restored from its backup copy.')
})

test('a plan that cannot be read at all is listed with a plain error', async () => {
  const folder = await createPlanFolder(root, newPlan('Box', 'p_1'))
  await writeFile(join(root, folder, 'plan.json'), 'nope')
  await rm(join(root, folder, 'plan.json.bak'), { force: true })
  const [entry] = await listPlans(root)
  expect(entry.plan).toBeNull()
  expect(entry.error).toMatch(/can't be opened/)
})

test('a cancelled import is removed completely; paths outside the plans folder are refused', async () => {
  const folder = await createPlanFolder(root, newPlan('Half done', 'p_1'))
  await savePage(root, folder, 1, new Uint8Array([137, 80, 78, 71]))
  await deletePlanFolder(root, folder)
  await expect(stat(join(root, folder))).rejects.toThrow()
  await expect(deletePlanFolder(root, '..')).rejects.toThrow()
  await expect(deletePlanFolder(root, '../other')).rejects.toThrow()
})

test('pages are numbered page-001.png …', async () => {
  const folder = await createPlanFolder(root, newPlan('Box', 'p_1'))
  await savePage(root, folder, 3, new Uint8Array([1, 2, 3]))
  expect([...(await readFile(join(root, folder, 'pages', 'page-003.png')))]).toEqual([1, 2, 3])
})

test('an attached design is copied in, so it survives the original being deleted', async () => {
  const folder = await createPlanFolder(root, newPlan('Box', 'p_1'))
  await attachDesign(root, folder, '{"design":true}')
  expect(await readDesign(root, folder)).toBe('{"design":true}')
  expect((await loadPlan(root, folder)).plan.design).toBe('design.aaw')
})

test('no design attached reads as null', async () => {
  const folder = await createPlanFolder(root, newPlan('Box', 'p_1'))
  expect(await readDesign(root, folder)).toBeNull()
})

// ---- Final review fixes ----
import { renamePlanFolder } from '../../electron/plansStore'

test('a plan folder follows the plan name, staying unique', async () => {
  const a = await createPlanFolder(root, newPlan('New plan', 'p_a'))
  await createPlanFolder(root, newPlan('Bench', 'p_b'))
  expect(await renamePlanFolder(root, a, 'Bench')).toBe('Bench (2)')
  expect((await listPlans(root)).map(e => e.folder).sort()).toEqual(['Bench', 'Bench (2)'])
  expect(await renamePlanFolder(root, 'Bench', 'Bench')).toBe('Bench')
})

test('page numbers must be whole numbers and folders a single name', async () => {
  const folder = await createPlanFolder(root, newPlan('Box', 'p_1'))
  await expect(savePage(root, folder, '/../../x' as unknown as number, new Uint8Array([1]))).rejects.toThrow()
  await expect(savePage(root, folder, 0, new Uint8Array([1]))).rejects.toThrow()
  await expect(loadPlan(root, `${folder}/photos`)).rejects.toThrow()
})

test('Windows reserved names and very long names make valid folders', () => {
  expect(folderName('CON', [])).toBe('CON plan')
  expect(folderName('x'.repeat(200), []).length).toBeLessThanOrEqual(80)
})
