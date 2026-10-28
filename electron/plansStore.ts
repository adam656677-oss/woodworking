// My Plans on disk: one folder per plan under Documents/A&A Woodworking/Plans.
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { join, relative, resolve, sep } from 'node:path'
import { isPlan, type Plan } from '../src/plans/types'
import { defaultFolder, safeSave } from './fileStore'

export function plansRoot(docsDir: string): string {
  return join(defaultFolder(docsDir), 'Plans')
}

/** A folder name Windows accepts, unique among `existing` (adds " (2)", " (3)" …). */
export function folderName(name: string, existing: string[]): string {
  const clean = name.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').replace(/^[\s.]+|[\s.]+$/g, '') || 'Plan'
  const taken = new Set(existing.map(e => e.toLowerCase()))
  if (!taken.has(clean.toLowerCase())) return clean
  for (let n = 2; ; n++) {
    const candidate = `${clean} (${n})`
    if (!taken.has(candidate.toLowerCase())) return candidate
  }
}

/** The folder's full path, refusing anything that would land outside the plans folder. */
function folderPath(root: string, folder: string): string {
  const full = resolve(root, folder)
  const rel = relative(resolve(root), full)
  if (!rel || rel.startsWith('..') || rel.includes(`..${sep}`) || resolve(root, rel) !== full) throw new Error('That plan folder is not inside My Plans')
  return full
}

async function readPlanFile(path: string): Promise<Plan | null> {
  try {
    const v = JSON.parse(await readFile(path, 'utf8'))
    return isPlan(v) ? v : null
  } catch {
    return null
  }
}

export async function loadPlan(root: string, folder: string): Promise<{ plan: Plan; notice: string | null }> {
  const file = join(folderPath(root, folder), 'plan.json')
  const plan = await readPlanFile(file)
  if (plan) return { plan, notice: null }
  const bak = await readPlanFile(`${file}.bak`)
  if (bak) return { plan: bak, notice: 'This plan was restored from its backup copy.' }
  throw new Error(`This plan can't be opened. Its folder is ${folderPath(root, folder)}`)
}

export async function listPlans(root: string): Promise<{ folder: string; plan: Plan | null; error?: string; notice?: string }[]> {
  let names: string[] = []
  try {
    names = (await readdir(root, { withFileTypes: true })).filter(d => d.isDirectory()).map(d => d.name)
  } catch {
    return []
  }
  const out: { folder: string; plan: Plan | null; error?: string; notice?: string }[] = []
  for (const folder of names.sort((a, b) => a.localeCompare(b))) {
    try {
      const { plan, notice } = await loadPlan(root, folder)
      out.push(notice ? { folder, plan, notice } : { folder, plan })
    } catch (e) {
      out.push({ folder, plan: null, error: (e as Error).message })
    }
  }
  return out
}

export async function savePlan(root: string, folder: string, plan: Plan): Promise<void> {
  if (!isPlan(plan)) throw new Error('This plan is incomplete and was not saved')
  await safeSave(join(folderPath(root, folder), 'plan.json'), JSON.stringify(plan, null, 2))
}

/** Make a new folder for the plan (named after it) and save it there. Returns the folder name. */
export async function createPlanFolder(root: string, plan: Plan): Promise<string> {
  await mkdir(root, { recursive: true })
  const existing = (await readdir(root, { withFileTypes: true })).filter(d => d.isDirectory()).map(d => d.name)
  const folder = folderName(plan.name, existing)
  await mkdir(folderPath(root, folder))
  await savePlan(root, folder, plan)
  return folder
}

/** Remove a plan folder (used when an import is cancelled). */
export async function deletePlanFolder(root: string, folder: string): Promise<void> {
  await rm(folderPath(root, folder), { recursive: true, force: true })
}

export async function savePage(root: string, folder: string, n: number, png: Uint8Array): Promise<string> {
  const dir = join(folderPath(root, folder), 'pages')
  await mkdir(dir, { recursive: true })
  const name = `page-${String(n).padStart(3, '0')}.png`
  await writeFile(join(dir, name), png)
  return `pages/${name}`
}

export async function savePhotoBytes(root: string, folder: string, id: string, jpg: Uint8Array): Promise<string> {
  if (!/^[\w-]+$/.test(id)) throw new Error('Bad photo name')
  const dir = join(folderPath(root, folder), 'photos')
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, `${id}.jpg`), jpg)
  return `photos/${id}.jpg`
}

/** Copy a design into the plan, so the plan is complete on its own. */
export async function attachDesign(root: string, folder: string, aawText: string): Promise<void> {
  await safeSave(join(folderPath(root, folder), 'design.aaw'), aawText)
  const { plan } = await loadPlan(root, folder)
  if (plan.design !== 'design.aaw') await savePlan(root, folder, { ...plan, design: 'design.aaw' })
}

export async function readDesign(root: string, folder: string): Promise<string | null> {
  try {
    return await readFile(join(folderPath(root, folder), 'design.aaw'), 'utf8')
  } catch {
    return null
  }
}

/** A file inside the plan (a page or photo) as a data URL for display. */
export async function fileDataUrl(root: string, folder: string, rel: string): Promise<string | null> {
  if (!/^(pages|photos)\/[\w.-]+\.(png|jpg)$/.test(rel)) return null
  try {
    const path = join(folderPath(root, folder), ...rel.split('/'))
    await stat(path)
    const data = await readFile(path)
    return `data:image/${rel.endsWith('.png') ? 'png' : 'jpeg'};base64,${data.toString('base64')}`
  } catch {
    return null
  }
}
